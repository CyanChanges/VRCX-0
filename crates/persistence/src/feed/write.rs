#![allow(non_snake_case)]

use vrcx_0_core::json::RawJson;

use crate::common::{delete_all_sql, delete_where_lt_sql, ParamsBuilder};
use crate::database::DatabaseService;
use crate::realtime::{
    ensure_realtime_tables, normalize_user_table_prefix, write_realtime_batch,
    RealtimePersistenceBatch,
};
use crate::Error;

pub fn feed_add_entry(db: &DatabaseService, user_id: String, entry: RawJson) -> Result<(), Error> {
    write_realtime_batch(
        db,
        &user_id,
        &RealtimePersistenceBatch {
            feed_entries: vec![entry.into_value()],
            ..RealtimePersistenceBatch::default()
        },
    )?;
    Ok(())
}

pub fn feed_avatar_purge(
    db: &DatabaseService,
    user_id: String,
    cutoff_date: Option<String>,
) -> Result<i64, Error> {
    let user_prefix = normalize_user_table_prefix(&user_id)?;
    ensure_realtime_tables(db, &user_prefix)?;
    if let Some(cutoff_date) = cutoff_date.filter(|value| !value.trim().is_empty()) {
        return db.execute_non_query(
            &delete_where_lt_sql(
                &format!("{user_prefix}_feed_avatar"),
                "created_at",
                "cutoff",
            ),
            &ParamsBuilder::new().set("cutoff", cutoff_date).build(),
        );
    }
    db.execute_non_query(
        &delete_all_sql(&format!("{user_prefix}_feed_avatar")),
        &Default::default(),
    )
}
