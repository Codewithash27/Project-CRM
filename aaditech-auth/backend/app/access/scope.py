"""Reusable CRM record scope for company and owner visibility."""

import uuid
from dataclasses import dataclass
from enum import StrEnum

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.roles.service import RoleName
from app.users.models import User

_ALL_ROLES = frozenset({RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.BUSINESS_OWNER})
_TEAM_ROLES = frozenset({RoleName.SALES_MANAGER})


class AccessScope(StrEnum):
    OWN = "OWN"
    TEAM = "TEAM"
    ALL = "ALL"


@dataclass(frozen=True)
class RecordScope:
    """Filter for a future owner-scoped CRM row.

    owner_ids is None when every owner is visible, subject to company_id.
    company_id is None when no company filter applies. A platform administrator
    uses that form. An administrator with no company gets an empty owner_ids
    set so another company's rows stay hidden.
    """

    level: AccessScope
    company_id: uuid.UUID | None
    owner_ids: set[uuid.UUID] | None


def resolve_access_scope(user: User) -> AccessScope:
    """Return the widest scope granted by the user's roles.

    SALES_REP, SALESPERSON, VIEWER, and MARKETING are OWN.
    SALES_MANAGER is TEAM. ADMIN, BUSINESS_OWNER, and SUPER_ADMIN are ALL.
    """

    names = {link.role.name for link in user.user_roles}
    if names & _ALL_ROLES:
        return AccessScope.ALL
    if names & _TEAM_ROLES:
        return AccessScope.TEAM
    return AccessScope.OWN


def resolve_record_scope(db: Session, user: User) -> RecordScope:
    """Resolve the owner and company filter for the current user."""

    level = resolve_access_scope(user)
    if level is AccessScope.ALL:
        if any(link.role.name == RoleName.SUPER_ADMIN for link in user.user_roles):
            return RecordScope(level=level, company_id=None, owner_ids=None)
        if user.company_id is None:
            return RecordScope(level=level, company_id=None, owner_ids=set())
        return RecordScope(level=level, company_id=user.company_id, owner_ids=None)
    if level is AccessScope.TEAM:
        return RecordScope(
            level=level,
            company_id=user.company_id,
            owner_ids=_team_owner_ids(db, user),
        )
    return RecordScope(level=level, company_id=user.company_id, owner_ids={user.id})


def record_is_in_scope(
    scope: RecordScope,
    *,
    owner_id: uuid.UUID,
    company_id: uuid.UUID | None,
) -> bool:
    """Return whether one CRM row is visible.

    Example::

        scope = resolve_record_scope(db, current_user)
        visible = record_is_in_scope(
            scope,
            owner_id=lead.owner_id,
            company_id=lead.company_id,
        )
    """

    if scope.owner_ids is not None and owner_id not in scope.owner_ids:
        return False
    if scope.company_id is not None and company_id != scope.company_id:
        return False
    return True


def get_record_scope(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecordScope:
    """FastAPI dependency for the caller's company and owner scope."""

    return resolve_record_scope(db, user)


def _team_owner_ids(db: Session, user: User) -> set[uuid.UUID]:
    if user.team_id is None:
        return {user.id}
    stmt = select(User.id).where(User.team_id == user.team_id)
    if user.company_id is not None:
        stmt = stmt.where(User.company_id == user.company_id)
    return set(db.scalars(stmt).all()) | {user.id}
