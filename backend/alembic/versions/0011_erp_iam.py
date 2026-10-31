"""ERP accounts, sessions, login attempts; audit log gets ERP actor + IP and becomes append-only

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Refuse deletes (row by row or TRUNCATE) and edits of what happened. Clearing the actor (ON DELETE SET NULL
# when an account is removed) is still allowed.
APPEND_ONLY_FN = """
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'audit_log is append-only';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.action IS DISTINCT FROM OLD.action
     OR NEW.target_type IS DISTINCT FROM OLD.target_type
     OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.detail::text IS DISTINCT FROM OLD.detail::text
     OR NEW.ip IS DISTINCT FROM OLD.ip
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id)
     OR (NEW.staff_farmer_id IS NOT NULL AND NEW.staff_farmer_id IS DISTINCT FROM OLD.staff_farmer_id) THEN
    RAISE EXCEPTION 'audit_log is append-only';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('erp_users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('public_id', sa.String(length=36), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=16), nullable=True),
    sa.Column('user_type', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('totp_secret_enc', sa.String(length=255), nullable=True),
    sa.Column('totp_enabled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('totp_last_step', sa.Integer(), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.Integer(), nullable=True),
    sa.Column('updated_by_id', sa.Integer(), nullable=True),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['erp_users.id'], name=op.f('fk_erp_users_created_by_id_erp_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['updated_by_id'], ['erp_users.id'], name=op.f('fk_erp_users_updated_by_id_erp_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_users')),
    sa.UniqueConstraint('email', name=op.f('uq_erp_users_email')),
    sa.UniqueConstraint('public_id', name=op.f('uq_erp_users_public_id'))
    )
    op.create_index(op.f('ix_erp_users_status'), 'erp_users', ['status'], unique=False)

    op.create_table('erp_login_attempts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('stage', sa.String(length=10), nullable=False),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_login_attempts'))
    )
    op.create_index(op.f('ix_erp_login_attempts_created_at'), 'erp_login_attempts', ['created_at'], unique=False)
    op.create_index(op.f('ix_erp_login_attempts_email'), 'erp_login_attempts', ['email'], unique=False)
    op.create_index(op.f('ix_erp_login_attempts_ip'), 'erp_login_attempts', ['ip'], unique=False)

    op.create_table('erp_backup_codes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['erp_users.id'], name=op.f('fk_erp_backup_codes_user_id_erp_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_backup_codes'))
    )
    op.create_index(op.f('ix_erp_backup_codes_user_id'), 'erp_backup_codes', ['user_id'], unique=False)

    op.create_table('erp_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('public_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('refresh_hash', sa.String(length=64), nullable=False),
    sa.Column('previous_refresh_hash', sa.String(length=64), nullable=True),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoke_reason', sa.String(length=30), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['erp_users.id'], name=op.f('fk_erp_sessions_user_id_erp_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_sessions')),
    sa.UniqueConstraint('public_id', name=op.f('uq_erp_sessions_public_id')),
    sa.UniqueConstraint('refresh_hash', name=op.f('uq_erp_sessions_refresh_hash'))
    )
    op.create_index(op.f('ix_erp_sessions_previous_refresh_hash'), 'erp_sessions', ['previous_refresh_hash'], unique=False)
    op.create_index(op.f('ix_erp_sessions_user_id'), 'erp_sessions', ['user_id'], unique=False)

    op.create_table('erp_user_roles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('role_code', sa.String(length=30), nullable=False),
    sa.Column('created_by_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['erp_users.id'], name=op.f('fk_erp_user_roles_created_by_id_erp_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['erp_users.id'], name=op.f('fk_erp_user_roles_user_id_erp_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_user_roles')),
    sa.UniqueConstraint('user_id', 'role_code', name=op.f('uq_erp_user_roles_user_id'))
    )
    op.create_index(op.f('ix_erp_user_roles_user_id'), 'erp_user_roles', ['user_id'], unique=False)

    op.create_table('erp_user_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('purpose', sa.String(length=20), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['erp_users.id'], name=op.f('fk_erp_user_tokens_user_id_erp_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_user_tokens')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_erp_user_tokens_token_hash'))
    )
    op.create_index(op.f('ix_erp_user_tokens_user_id'), 'erp_user_tokens', ['user_id'], unique=False)

    op.add_column('audit_log', sa.Column('actor_user_id', sa.Integer(), nullable=True))
    op.add_column('audit_log', sa.Column('ip', sa.String(length=45), nullable=True))
    op.alter_column('audit_log', 'action', existing_type=sa.String(length=40), type_=sa.String(length=60), existing_nullable=False)
    op.alter_column('audit_log', 'target_type', existing_type=sa.String(length=20), type_=sa.String(length=40), existing_nullable=False)
    op.create_index(op.f('ix_audit_log_actor_user_id'), 'audit_log', ['actor_user_id'], unique=False)
    op.create_foreign_key(op.f('fk_audit_log_actor_user_id_erp_users'), 'audit_log', 'erp_users', ['actor_user_id'], ['id'], ondelete='SET NULL')

    if op.get_bind().dialect.name == 'postgresql':
        op.execute(APPEND_ONLY_FN)
        op.execute(
            "CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log "
            "FOR EACH ROW EXECUTE FUNCTION audit_log_append_only()"
        )
        op.execute(
            "CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log "
            "FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only()"
        )


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().dialect.name == 'postgresql':
        op.execute("DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log")
        op.execute("DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log")
        op.execute("DROP FUNCTION IF EXISTS audit_log_append_only()")
    op.drop_constraint(op.f('fk_audit_log_actor_user_id_erp_users'), 'audit_log', type_='foreignkey')
    op.drop_index(op.f('ix_audit_log_actor_user_id'), table_name='audit_log')
    op.alter_column('audit_log', 'target_type', existing_type=sa.String(length=40), type_=sa.String(length=20), existing_nullable=False)
    op.alter_column('audit_log', 'action', existing_type=sa.String(length=60), type_=sa.String(length=40), existing_nullable=False)
    op.drop_column('audit_log', 'ip')
    op.drop_column('audit_log', 'actor_user_id')
    op.drop_index(op.f('ix_erp_user_tokens_user_id'), table_name='erp_user_tokens')
    op.drop_table('erp_user_tokens')
    op.drop_index(op.f('ix_erp_user_roles_user_id'), table_name='erp_user_roles')
    op.drop_table('erp_user_roles')
    op.drop_index(op.f('ix_erp_sessions_user_id'), table_name='erp_sessions')
    op.drop_index(op.f('ix_erp_sessions_previous_refresh_hash'), table_name='erp_sessions')
    op.drop_table('erp_sessions')
    op.drop_index(op.f('ix_erp_backup_codes_user_id'), table_name='erp_backup_codes')
    op.drop_table('erp_backup_codes')
    op.drop_index(op.f('ix_erp_login_attempts_ip'), table_name='erp_login_attempts')
    op.drop_index(op.f('ix_erp_login_attempts_email'), table_name='erp_login_attempts')
    op.drop_index(op.f('ix_erp_login_attempts_created_at'), table_name='erp_login_attempts')
    op.drop_table('erp_login_attempts')
    op.drop_index(op.f('ix_erp_users_status'), table_name='erp_users')
    op.drop_table('erp_users')
