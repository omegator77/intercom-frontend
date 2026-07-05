import { CSSProperties, useEffect, useState } from "react";
import styled from "@emotion/styled";
import { API, TMemberInfo, TUserRole } from "../../api/api";
import {
  FormSelect,
  SecondaryButton,
  StyledWarningMessage,
} from "../form-elements/form-elements";
import { DeleteButton } from "../delete-button/delete-button-components";
import { ConfirmationModal } from "../verify-decision/confirmation-modal";

const Panel = styled.div`
  padding: 1rem;
  margin: 1rem 0;
  border: 0.1rem solid rgba(109, 109, 109, 0.3);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
`;

const MemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const MemberName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const MembersPanel = ({
  productionId,
  style,
}: {
  productionId: number;
  style?: CSSProperties;
}) => {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TMemberInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TMemberInfo | null>(null);

  const loadMembers = async () => {
    setError(null);
    try {
      const response = await API.getMembers(productionId);
      setMembers(response.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  };

  useEffect(() => {
    if (open) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changeRole = async (userId: string, role: TUserRole) => {
    try {
      await API.updateMemberRole({ productionId, userId, role });
      await loadMembers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the role"
      );
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await API.removeMember({ productionId, userId });
      setRemoveTarget(null);
      await loadMembers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove the member"
      );
    }
  };

  if (!open) {
    return (
      <SecondaryButton
        style={style}
        type="button"
        onClick={() => setOpen(true)}
      >
        Members
      </SecondaryButton>
    );
  }

  return (
    <Panel>
      <MemberRow>
        <strong>Members</strong>
        <SecondaryButton type="button" onClick={() => setOpen(false)}>
          Close
        </SecondaryButton>
      </MemberRow>
      {error && <StyledWarningMessage>{error}</StyledWarningMessage>}
      {members?.length === 0 && <span>No members yet.</span>}
      {members?.map((member) => (
        <MemberRow key={member.userId}>
          <MemberName>
            {member.alias || member.displayName} ({member.username})
          </MemberName>
          <FormSelect
            value={member.role}
            onChange={(e) =>
              changeRole(member.userId, e.target.value as TUserRole)
            }
          >
            <option value="participant">Participant</option>
            <option value="producer">Producer</option>
            <option value="admin">Admin</option>
          </FormSelect>
          <DeleteButton type="button" onClick={() => setRemoveTarget(member)}>
            Remove
          </DeleteButton>
        </MemberRow>
      ))}
      {removeTarget && (
        <ConfirmationModal
          title="Remove member"
          description={`Remove ${removeTarget.displayName} from this production? They keep their account and can be invited again later.`}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => removeMember(removeTarget.userId)}
        />
      )}
    </Panel>
  );
};
