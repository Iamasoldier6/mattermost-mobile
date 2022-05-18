// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {t} from '@i18n';
import keyMirror from '@utils/key_mirror';

export const SNACK_BAR_TYPE = keyMirror({
    LINK_COPIED: null,
    MESSAGE_COPIED: null,
    MUTE_CHANNEL: null,
});

type SnackBarConfig = {
    id: string;
    defaultMessage: string;
    iconName: string;
    canUndo: boolean;
};
export const SNACK_BAR_CONFIG: Record<string, SnackBarConfig> = {
    LINK_COPIED: {
        id: t('snack.bar.link.copied'),
        defaultMessage: 'Link copied to clipboard',
        iconName: 'link-variant',
        canUndo: false,
    },
    MESSAGE_COPIED: {
        id: t('snack.bar.message.copied'),
        defaultMessage: 'Text copied to clipboard',
        iconName: 'content-copy',
        canUndo: false,
    },
    MUTE_CHANNEL: {
        id: t('snack.bar.mute.channel'),
        defaultMessage: 'This channel was muted',
        iconName: 'bell-off-outline',
        canUndo: true,
    },
};

export default {
    SNACK_BAR_TYPE,
    SNACK_BAR_CONFIG,
};
