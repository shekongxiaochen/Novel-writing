use std::sync::Arc;

use super::{AiProviderService, AiService, AuthService, AutoApplyLogService, CardKeyService, CharacterStateService, EmbeddingIndexService, ImageProviderService, NovelService, SettingsService, WalletService};

#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<AuthService>,
    pub novels: Arc<NovelService>,
    pub settings: Arc<SettingsService>,
    pub wallet: Arc<WalletService>,
    pub card_keys: Arc<CardKeyService>,
    pub providers: Arc<AiProviderService>,
    pub image_providers: Arc<ImageProviderService>,
    pub ai: Arc<AiService>,
    pub embedding_index: Arc<EmbeddingIndexService>,
    pub character_states: Arc<CharacterStateService>,
    pub auto_apply_log: Arc<AutoApplyLogService>,
}
