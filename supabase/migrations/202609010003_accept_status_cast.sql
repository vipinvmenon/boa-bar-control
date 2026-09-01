-- BAR-053/BAR-055 follow-up found during BAR-064 hosted behavior testing.
-- The acceptance function predates its later session-actor rename. Its CASE
-- expression resolves to text, which PostgreSQL will not assign implicitly to
-- boa_bar_docket_status; the live acceptance path had therefore never worked.

begin;

do $$
declare
  v_definition text;
  v_fixed text;
begin
  select pg_get_functiondef(
    'public.boa_bar_accept_docket_session_actor(jsonb)'::regprocedure
  ) into v_definition;

  if position('::public.boa_bar_docket_status' in v_definition) > 0 then
    return;
  end if;

  v_fixed := replace(
    v_definition,
    'set status = CASE WHEN v_short THEN ''accepted_short'' ELSE ''accepted'' END,',
    'set status = (CASE WHEN v_short THEN ''accepted_short'' ELSE ''accepted'' END)::public.boa_bar_docket_status,'
  );

  if v_fixed = v_definition then
    v_fixed := replace(
      v_definition,
      'set status = case when v_short then ''accepted_short'' else ''accepted'' end,',
      'set status = (case when v_short then ''accepted_short'' else ''accepted'' end)::public.boa_bar_docket_status,'
    );
  end if;

  if v_fixed = v_definition then
    raise exception 'accept-docket status assignment was not found';
  end if;

  execute v_fixed;
end;
$$;

commit;
