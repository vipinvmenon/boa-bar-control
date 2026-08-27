begin;
select plan(11);

select has_table('public', 'boa_bar_movement', 'movement table exists');
select has_table('public', 'boa_bar_movement_line', 'movement line table exists');
select has_function('public', 'boa_bar_submit_movement', array['jsonb'], 'submission RPC exists');
select col_is_pk('public', 'boa_bar_movement', 'id', 'movement id is primary key');
select col_is_fk('public', 'boa_bar_movement_line', 'movement_id', 'line references movement');
select policies_are('public', 'boa_bar_movement', array['boa_bar_movement_read'], 'ledger exposes read policy only');
select trigger_is('public', 'boa_bar_movement', 'boa_bar_movement_immutable', 'private', 'boa_bar_reject_mutation', 'movement is immutable');
select trigger_is('public', 'boa_bar_movement_line', 'boa_bar_movement_line_immutable', 'private', 'boa_bar_reject_mutation', 'movement lines are immutable');
select has_function('public', 'boa_bar_inventory_snapshot', array['uuid'], 'authorised inventory snapshot RPC exists');
select has_function('public', 'boa_bar_sync_status', array['uuid'], 'sync status RPC exists');
select has_column('public', 'boa_bar_docket', 'token_hash', 'docket stores a token hash');

select * from finish();
rollback;
