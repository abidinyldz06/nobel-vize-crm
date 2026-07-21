-- Faz 1 veri kalite kontrolleri production'da sifirlandiktan sonra, gecis
-- sirasinda NOT VALID eklenen check ve foreign key constraint'lerini kesinlestirir.

BEGIN;

ALTER TABLE public.activity_log VALIDATE CONSTRAINT activity_log_actor_fk;
ALTER TABLE public.activity_log VALIDATE CONSTRAINT activity_log_application_fk;
ALTER TABLE public.activity_log VALIDATE CONSTRAINT activity_log_customer_fk;

ALTER TABLE public.applications VALIDATE CONSTRAINT applications_assigned_staff_fk;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_customer_fk;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_customer_required;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_fees_nonnegative;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_status_valid;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_visa_type_valid;

ALTER TABLE public.communications VALIDATE CONSTRAINT communications_actor_fk;
ALTER TABLE public.communications VALIDATE CONSTRAINT communications_application_fk;
ALTER TABLE public.communications VALIDATE CONSTRAINT communications_customer_fk;

ALTER TABLE public.country_visa_rules VALIDATE CONSTRAINT country_visa_rules_documents_array;
ALTER TABLE public.country_visa_rules VALIDATE CONSTRAINT rules_country_fk;

ALTER TABLE public.customers VALIDATE CONSTRAINT customers_assigned_staff_fk;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_profile_score_valid;

ALTER TABLE public.documents VALIDATE CONSTRAINT documents_application_fk;
ALTER TABLE public.documents VALIDATE CONSTRAINT documents_application_required;
ALTER TABLE public.documents VALIDATE CONSTRAINT documents_status_valid;

ALTER TABLE public.family_members VALIDATE CONSTRAINT family_members_customer_fk;

ALTER TABLE public.notes VALIDATE CONSTRAINT notes_application_fk;
ALTER TABLE public.notes VALIDATE CONSTRAINT notes_created_by_fk;

ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_nonnegative;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_application_fk;

ALTER TABLE public.staff VALIDATE CONSTRAINT staff_role_valid;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_user_fk;

ALTER TABLE public.visa_history VALIDATE CONSTRAINT visa_history_customer_fk;
ALTER TABLE public.webhook_events VALIDATE CONSTRAINT webhook_events_status_valid;

COMMIT;
