-- CW Enterprise's own address is an admin alongside Elevate Studio; the address the shared baseline once listed
-- (Västkust Bygg's) has no place here.
delete from private.admin_allowlist where email = 'info@vastkustbygg.se';
insert into private.admin_allowlist (email) values ('info@cwenterprise.se') on conflict do nothing;
