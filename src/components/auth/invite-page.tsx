import { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { API, TInviteInfoResponse } from "../../api/api";
import { useAuth } from "../../auth/use-auth";
import { DisplayContainerHeader } from "../landing-page/display-container-header";
import { ButtonWrapper, ResponsiveFormContainer } from "../generic-components";
import {
  DecorativeLabel,
  FormInput,
  FormLabel,
  PrimaryButton,
  StyledWarningMessage,
} from "../form-elements/form-elements";
import { isMobile } from "../../bowser";

type FormValues = {
  username: string;
  password: string;
  displayName: string;
};

export const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [invite, setInvite] = useState<TInviteInfoResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { username: "", password: "", displayName: "" },
  });

  useEffect(() => {
    if (!token) return;
    API.getInvite(token)
      .then(setInvite)
      .catch((err) =>
        setInviteError(
          err instanceof Error ? err.message : "This invite link is invalid"
        )
      );
  }, [token]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!token) return;
    setSubmitError(null);
    setLoading(true);
    try {
      await API.acceptInvite({ token, ...values });
      await refresh();
      navigate("/");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to accept invite"
      );
    } finally {
      setLoading(false);
    }
  };

  if (inviteError) {
    return (
      <ResponsiveFormContainer className={isMobile ? "" : "desktop"}>
        <DisplayContainerHeader>Invite</DisplayContainerHeader>
        <StyledWarningMessage>{inviteError}</StyledWarningMessage>
      </ResponsiveFormContainer>
    );
  }

  if (!invite) return null;

  return (
    <ResponsiveFormContainer className={isMobile ? "" : "desktop"}>
      <DisplayContainerHeader>
        Join &quot;{invite.productionName}&quot; as {invite.role}
      </DisplayContainerHeader>
      <FormLabel>
        <DecorativeLabel>Username</DecorativeLabel>
        <FormInput
          // eslint-disable-next-line
          {...register("username", { required: true })}
          placeholder="Username"
          autoFocus
        />
      </FormLabel>
      <FormLabel>
        <DecorativeLabel>Display name</DecorativeLabel>
        <FormInput
          // eslint-disable-next-line
          {...register("displayName", { required: true })}
          placeholder="This is the name shown in the intercom"
        />
      </FormLabel>
      <FormLabel>
        <DecorativeLabel>Password</DecorativeLabel>
        <FormInput
          // eslint-disable-next-line
          {...register("password", { required: true })}
          type="password"
          placeholder="Password"
        />
      </FormLabel>
      {submitError && (
        <StyledWarningMessage>{submitError}</StyledWarningMessage>
      )}
      <ButtonWrapper>
        <PrimaryButton
          type="button"
          disabled={loading}
          onClick={handleSubmit(onSubmit)}
        >
          Create account &amp; join
        </PrimaryButton>
      </ButtonWrapper>
    </ResponsiveFormContainer>
  );
};
