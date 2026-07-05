import { CSSProperties, useState } from "react";
import styled from "@emotion/styled";
import { API, TInviteResponse, TUserRole } from "../../api/api";
import {
  FormSelect,
  PrimaryButton,
  SecondaryButton,
  StyledWarningMessage,
} from "../form-elements/form-elements";

const InvitePanel = styled.div`
  padding: 1rem;
  margin: 1rem 0;
  border: 0.1rem solid rgba(109, 109, 109, 0.3);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
`;

const InviteRow = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const InviteLinkInput = styled.input`
  flex: 1;
  font-size: 1.4rem;
  padding: 0.5rem;
`;

export const InviteButton = ({
  productionId,
  style,
}: {
  productionId: number;
  style?: CSSProperties;
}) => {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<TUserRole>("participant");
  const [invite, setInvite] = useState<TInviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await API.createInvite({ productionId, role });
      setInvite(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invite link"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <SecondaryButton
        style={style}
        type="button"
        onClick={() => setOpen(true)}
      >
        Invite
      </SecondaryButton>
    );
  }

  return (
    <InvitePanel>
      <InviteRow>
        <FormSelect
          value={role}
          onChange={(e) => setRole(e.target.value as TUserRole)}
        >
          <option value="participant">Participant</option>
          <option value="producer">Producer</option>
          <option value="admin">Admin</option>
        </FormSelect>
        <PrimaryButton type="button" disabled={loading} onClick={generate}>
          Generate link
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => setOpen(false)}>
          Close
        </SecondaryButton>
      </InviteRow>
      {error && <StyledWarningMessage>{error}</StyledWarningMessage>}
      {invite && (
        <InviteRow>
          <InviteLinkInput
            readOnly
            value={invite.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <SecondaryButton
            type="button"
            onClick={() => navigator.clipboard.writeText(invite.url)}
          >
            Copy
          </SecondaryButton>
        </InviteRow>
      )}
    </InvitePanel>
  );
};
