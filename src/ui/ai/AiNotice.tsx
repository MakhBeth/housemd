import {useSyncExternalStore} from 'react';
import type {AiController} from '../../ai/aiController';
import {useT} from '../../i18n/I18nProvider';
import type {MessageKey} from '../../i18n/messages';
export function AiNotice({controller}:{controller:AiController}){const state=useSyncExternalStore(controller.subscribe,controller.getState),t=useT();return state.error?<div role="alert" className="ai-notice">{t(`ai.error.${state.error}` as MessageKey)}<button onClick={()=>controller.clearError()}>{t('settings.close')}</button></div>:null;}
