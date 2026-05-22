use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "payment_orders")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub user_id: String,
    pub subscription_id: Option<String>,
    pub product_code: String,
    pub plan_code: String,
    pub status: String,
    pub amount_cents: i32,
    pub currency: String,
    pub payment_provider: String,
    pub provider_trade_no: String,
    #[sea_orm(column_type = "Json", nullable)]
    pub checkout_payload: Option<Json>,
    pub paid_at: Option<DateTimeUtc>,
    pub expires_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
