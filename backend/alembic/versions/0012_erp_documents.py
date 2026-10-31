"""ERP private documents (KYC proofs, licences); file bytes are encrypted in document storage

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-31 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0012'
down_revision: Union[str, Sequence[str], None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('erp_documents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('public_id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=40), nullable=False),
    sa.Column('owner_type', sa.String(length=20), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('storage_key', sa.String(length=60), nullable=False),
    sa.Column('original_filename', sa.String(length=200), nullable=False),
    sa.Column('content_type', sa.String(length=40), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('uploaded_by_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['erp_users.id'], name=op.f('fk_erp_documents_deleted_by_id_erp_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['uploaded_by_id'], ['erp_users.id'], name=op.f('fk_erp_documents_uploaded_by_id_erp_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_erp_documents')),
    sa.UniqueConstraint('public_id', name=op.f('uq_erp_documents_public_id')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_erp_documents_storage_key'))
    )
    op.create_index('ix_erp_documents_owner', 'erp_documents', ['owner_type', 'owner_id'], unique=False)
    op.create_index(op.f('ix_erp_documents_created_at'), 'erp_documents', ['created_at'], unique=False)
    op.create_index(op.f('ix_erp_documents_uploaded_by_id'), 'erp_documents', ['uploaded_by_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_erp_documents_uploaded_by_id'), table_name='erp_documents')
    op.drop_index(op.f('ix_erp_documents_created_at'), table_name='erp_documents')
    op.drop_index('ix_erp_documents_owner', table_name='erp_documents')
    op.drop_table('erp_documents')
