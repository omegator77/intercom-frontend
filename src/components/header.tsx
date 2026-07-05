import styled from "@emotion/styled";
import { FC, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { HeadsetIcon } from "../assets/icons/icon.tsx";
import { backgroundColour } from "../css-helpers/defaults.ts";
import { mediaQueries } from "./generic-components.ts";
import { useGlobalState } from "../global-state/context-provider.tsx";
import { useAudioCue } from "./production-line/use-audio-cue.ts";
import { ConfirmationModal } from "./verify-decision/confirmation-modal.tsx";
import { useAuth } from "../auth/use-auth.ts";

const HeaderWrapper = styled.div`
  width: 100%;
  background: ${backgroundColour};
  margin: 0 0 1rem 0;
`;

const HomeButton = styled.button`
  background: ${backgroundColour};
  border: none;
  padding: 1rem;
  display: flex;
  align-items: center;
  width: fit-content;
  font-size: 3rem;
  font-weight: semi-bold;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.87);

  svg {
    width: 2.4rem;
    height: 2.4rem;
    margin-right: 1rem;
    margin-left: 1rem;
    fill: #59cbe8;
  }

  ${mediaQueries.isSmallScreen} {
    font-size: 2rem;

    svg {
      width: 2rem;
      height: 2rem;
    }
  }
`;

const AccountArea = styled.div`
  float: right;
  padding: 1rem 2rem;
  color: rgba(255, 255, 255, 0.87);
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  gap: 1rem;

  button {
    background: none;
    border: 0.1rem solid rgba(255, 255, 255, 0.4);
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.4rem 1rem;
    cursor: pointer;
  }
`;

export const Header: FC = () => {
  const [confirmExitModalOpen, setConfirmExitModalOpen] = useState(false);
  const [{ calls }, dispatch] = useGlobalState();
  const navigate = useNavigate();
  const location = useLocation();
  const { playExitSound } = useAudioCue();
  const { me, logout } = useAuth();
  const isEmpty = Object.values(calls).length === 0;

  const runExitAllCalls = () => {
    setConfirmExitModalOpen(false);
    navigate("/");
    playExitSound();
    if (!isEmpty) {
      Object.entries(calls).forEach(([callId]) => {
        if (callId) {
          dispatch({
            type: "REMOVE_CALL",
            payload: { id: callId },
          });
        }
      });
    }
  };

  const returnToRoot = () => {
    if (location.pathname.includes("/line") && isEmpty) {
      runExitAllCalls();
    } else if (location.pathname.includes("/line")) {
      setConfirmExitModalOpen(true);
    } else {
      navigate("/");
    }
  };

  return (
    <>
      <HeaderWrapper>
        <HomeButton onClick={returnToRoot}>
          <HeadsetIcon />
          Open Intercom
        </HomeButton>
        <AccountArea>
          {me ? (
            <>
              <span>{me.user.alias || me.user.displayName}</span>
              <button type="button" onClick={() => logout()}>
                Log out
              </button>
            </>
          ) : (
            <button type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
          )}
        </AccountArea>
      </HeaderWrapper>
      {confirmExitModalOpen && (
        <ConfirmationModal
          title="Confirm"
          description="Are you sure you want to leave all calls?"
          confirmationText="This will leave all calls and return to the home page."
          onCancel={() => setConfirmExitModalOpen(false)}
          onConfirm={runExitAllCalls}
        />
      )}
    </>
  );
};
