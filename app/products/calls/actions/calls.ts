// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import InCallManager from 'react-native-incall-manager';

import {forceLogoutIfNecessary} from '@actions/remote/session';
import {fetchUsersByIds} from '@actions/remote/user';
import {hasMicrophonePermission} from '@app/products/calls/actions/permissions';
import {
    getState, myselfJoinedCall, myselfLeftCall,
    setCalls,
    setChannelEnabled,
    setConfig,
    setScreenShareURL,
    setSpeakerPhone,
} from '@app/products/calls/state';
import {
    Call,
    CallParticipant,
    CallsConnection,
    DefaultServerConfig,
    ServerChannelState,
} from '@app/products/calls/types/calls';
import Calls from '@constants/calls';
import NetworkManager from '@managers/network_manager';

import {newConnection} from '../connection/connection';

import type {Client} from '@client/rest';
import type ClientError from '@client/rest/error';
import type {IntlShape} from 'react-intl';

// Only exported for tests, not exported from the module index.
export let connection: CallsConnection | null = null;

export const loadConfig = async (serverUrl: string, force = false) => {
    if (!force) {
        const lastRetrievedAt = getState()?.config.last_retrieved_at || 0;
        if ((Date.now() - lastRetrievedAt) < Calls.RefreshConfigMillis) {
            return {};
        }
    }

    let client: Client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    let data;
    try {
        data = await client.getCallsConfig();
    } catch (error) {
        await forceLogoutIfNecessary(serverUrl, error as ClientError);

        // Reset the config to the default (off) since it looks like Calls is not enabled.
        setConfig({...DefaultServerConfig, last_retrieved_at: Date.now()});

        return {error};
    }

    const nextConfig = {...data, last_retrieved_at: Date.now()};
    setConfig(nextConfig);
    return {data: nextConfig};
};

export const loadCalls = async (serverUrl: string) => {
    let client: Client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    let resp: ServerChannelState[] = [];
    try {
        resp = await client.getCalls();
    } catch (error) {
        await forceLogoutIfNecessary(serverUrl, error as ClientError);
        return {error};
    }
    const callsResults: Dictionary<Call> = {};
    const enabledChannels: Dictionary<boolean> = {};

    // Batch userProfile calls in the background for the future
    const ids = new Set<string>();
    resp.forEach((channel) => {
        channel.call?.users.forEach((id) => ids.add(id));
    });
    if (ids.size > 0) {
        fetchUsersByIds(serverUrl, Array.from(ids));
    }

    for (let i = 0; i < resp.length; i++) {
        const channel = resp[i];
        if (channel.call) {
            const call = channel.call;
            callsResults[channel.channel_id] = {
                participants: channel.call.users.reduce((prev: Record<string, CallParticipant>, cur: string, curIdx: number) => {
                    const muted = call.states && call.states[curIdx] ? !call.states[curIdx].unmuted : true;
                    const raised_hand = call.states && call.states[curIdx] ? call.states[curIdx].raised_hand : 0;
                    prev[cur] = {id: cur, muted, raisedHand: raised_hand, isTalking: false};
                    return prev;
                }, {}),
                channelId: channel.channel_id,
                startTime: call.start_at,
                speakers: [],
                screenOn: call.screen_sharing_id,
                threadId: call.thread_id,
            };
        }
        enabledChannels[channel.channel_id] = channel.enabled;
    }

    setCalls(callsResults, enabledChannels);
    return {data: {calls: callsResults, enabled: enabledChannels}};
};

export const enableChannelCalls = async (serverUrl: string, channelId: string) => {
    let client: Client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    try {
        await client.enableChannelCalls(channelId);
    } catch (error) {
        await forceLogoutIfNecessary(serverUrl, error as ClientError);
        return {error};
    }

    setChannelEnabled(channelId, true);
    return {};
};

export const disableChannelCalls = async (serverUrl: string, channelId: string) => {
    let client: Client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    try {
        await client.disableChannelCalls(channelId);
    } catch (error) {
        await forceLogoutIfNecessary(serverUrl, error as ClientError);
        return {error};
    }

    setChannelEnabled(channelId, false);
    return {};
};

export const joinCall = async (serverUrl: string, channelId: string, intl: IntlShape) => {
    const hasPermission = await hasMicrophonePermission(intl);
    if (!hasPermission) {
        return {error: 'no permissions to microphone, unable to start call'};
    }

    if (connection) {
        connection.disconnect();
        connection = null;
    }
    setSpeakerphoneOn(false);

    try {
        connection = await newConnection(serverUrl, channelId, () => null, setScreenShareURL);
    } catch (error) {
        await forceLogoutIfNecessary(serverUrl, error as ClientError);
        return {error};
    }

    try {
        await connection.waitForReady();
        myselfJoinedCall(channelId);
        return {data: channelId};
    } catch (e) {
        connection.disconnect();
        connection = null;
        return {error: 'unable to connect to the voice call'};
    }
};

export const leaveCall = () => {
    if (connection) {
        connection.disconnect();
        connection = null;
    }
    setSpeakerphoneOn(false);
    myselfLeftCall();
};

export const muteMyself = () => {
    if (connection) {
        connection.mute();
    }
};

export const unmuteMyself = () => {
    if (connection) {
        connection.unmute();
    }
};

export const raiseHand = () => {
    if (connection) {
        connection.raiseHand();
    }
};

export const unraiseHand = () => {
    if (connection) {
        connection.unraiseHand();
    }
};

export const setSpeakerphoneOn = (speakerphoneOn: boolean) => {
    InCallManager.setSpeakerphoneOn(speakerphoneOn);
    setSpeakerPhone(speakerphoneOn);
};
