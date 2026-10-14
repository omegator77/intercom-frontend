import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import styled from "@emotion/styled";
import { useAuth } from "../../auth/use-auth";
import { API, TUserListInfo } from "../../api/api";
import { PageHeader } from "../page-layout/page-header";
import {
  SecondaryButton,
  StyledWarningMessage,
} from "../form-elements/form-elements";
import { DeleteButton } from "../delete-button/delete-button-components";
import { ConfirmationModal } from "../verify-decision/confirmation-modal";
import { DisplayContainer } from "../generic-components";

const List = styled(DisplayContainer)`
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const UserRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 0.1rem solid rgba(109, 109, 109, 0.3);

  &:last-of-type {
    border-bottom: 0;
  }
`;

const UserName = styled.span`
  flex: 1 1 auto;
  min-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MembershipCount = styled.span`
  color: rgba(255, 255, 255, 0.6);
  min-width: 10rem;
`;

const SuperAdminBadge = styled.span`
  padding: 0.2rem 0.8rem;
  border-radius: 1rem;
  background: rgba(89, 203, 232, 0.2);
  color: #59cbe8;
  font-size: 1.2rem;
  white-space: nowrap;
`;

export const ManageUsersPage = () => {
  const { isSuperAdmin, me, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<TUserListInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TUserListInfo | null>(null);
  const [roleTarget, setRoleTarget] = useState<TUserListInfo | null>(null);

  const loadUsers = async () => {
    setError(null);
    try {
      const response = await API.getUsers();
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const deleteUser = async (userId: string) => {
    try {
      await API.deleteUser(userId);
      setRemoveTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const changeSuperAdmin = async (user: TUserListInfo) => {
    try {
      await API.setUserSuperAdmin(user.userId, !user.isSuperAdmin);
      setRoleTarget(null);
      await loadUsers();
    } catch (err) {
      setRoleTarget(null);
      setError(
        err instanceof Error ? err.message : "Failed to change super admin role"
      );
    }
  };

  if (!authLoading && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <PageHeader title="Users" hasNavigateToRoot />
      <List>
        {error && <StyledWarningMessage>{error}</StyledWarningMessage>}
        {users?.length === 0 && <span>No users yet.</span>}
        {users?.map((user) => (
          <UserRow key={user.userId}>
            <UserName>
              {user.alias || user.displayName} ({user.username})
            </UserName>
            <MembershipCount>
              {user.membershipCount === 0
                ? "No productions"
                : `${user.membershipCount} production${
                    user.membershipCount === 1 ? "" : "s"
                  }`}
            </MembershipCount>
            {user.isSuperAdmin && (
              <SuperAdminBadge>Super admin</SuperAdminBadge>
            )}
            {user.userId !== me?.user.id && (
              <SecondaryButton
                type="button"
                onClick={() => setRoleTarget(user)}
              >
                {user.isSuperAdmin ? "Remove super admin" : "Make super admin"}
              </SecondaryButton>
            )}
            <DeleteButton
              type="button"
              disabled={user.membershipCount > 0}
              title={
                user.membershipCount > 0
                  ? "Still a member of at least one production"
                  : undefined
              }
              onClick={() => setRemoveTarget(user)}
            >
              Delete
            </DeleteButton>
          </UserRow>
        ))}
      </List>
      {roleTarget && (
        <ConfirmationModal
          title={
            roleTarget.isSuperAdmin ? "Remove super admin" : "Make super admin"
          }
          description={
            roleTarget.isSuperAdmin
              ? `Remove the super admin role from "${roleTarget.username}"? They keep only their own production memberships.`
              : `Make "${roleTarget.username}" a super admin? They get access to every production, can create productions and manage all users.`
          }
          onCancel={() => setRoleTarget(null)}
          onConfirm={() => changeSuperAdmin(roleTarget)}
        />
      )}
      {removeTarget && (
        <ConfirmationModal
          title="Delete user"
          description={`Permanently delete the account "${removeTarget.username}"? This cannot be undone.`}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => deleteUser(removeTarget.userId)}
        />
      )}
    </>
  );
};
