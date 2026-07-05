import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { API } from "../../api/api";
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
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { username: "", password: "" },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setLoginError(null);
    setLoading(true);
    try {
      await API.login(values);
      await refresh();
      navigate("/");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveFormContainer className={isMobile ? "" : "desktop"}>
      <DisplayContainerHeader>Log in</DisplayContainerHeader>
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
        <DecorativeLabel>Password</DecorativeLabel>
        <FormInput
          // eslint-disable-next-line
          {...register("password", { required: true })}
          type="password"
          placeholder="Password"
        />
      </FormLabel>
      {loginError && <StyledWarningMessage>{loginError}</StyledWarningMessage>}
      <ButtonWrapper>
        <PrimaryButton
          type="button"
          disabled={loading}
          onClick={handleSubmit(onSubmit)}
        >
          Log in
        </PrimaryButton>
      </ButtonWrapper>
    </ResponsiveFormContainer>
  );
};
