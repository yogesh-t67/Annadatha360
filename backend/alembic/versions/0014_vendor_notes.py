"""internal review notes on vendor applications

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-31 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0014'
down_revision: Union[str, Sequence[str], None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('vendor_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('author_id', sa.Integer(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['erp_users.id'], name=op.f('fk_vendor_notes_author_id_erp_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], name=op.f('fk_vendor_notes_vendor_id_vendors'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_vendor_notes'))
    )
    op.create_index(op.f('ix_vendor_notes_vendor_id'), 'vendor_notes', ['vendor_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_vendor_notes_vendor_id'), table_name='vendor_notes')
    op.drop_table('vendor_notes')
