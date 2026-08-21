import { useEffect, useRef, useState, useCallback } from "react";
import { API } from "../../../api/api";
import { generateWhepUrl } from "../../../utils/generateWhepUrl";
import { CopyButton } from "../../copy-button/copy-button";
import { DecorativeLabel } from "../../form-elements/form-elements";
import { Modal } from "../../modal/modal";
import { RefreshButton } from "../../refresh-button/refresh-button";
import {
  CombinedInputWrapper,
  InputWrapper,
  LinkLabel,
  ModalNoteWrapper,
  ModalText,
  ModalTextBold,
  ModalTextItalic,
  Wrapper,
} from "../generate-urls-components";

type TGenerateWhepUrlModalProps = {
  productionId: string;
  lineId: string;
  onClose: () => void;
};

export const GenerateWhepUrlModal = ({
  productionId,
  lineId,
  onClose,
}: TGenerateWhepUrlModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("");
  const [whepUrl, setWhepUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [whepAuthKey, setWhepAuthKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    API.getWhepAuthKey(Number(productionId))
      .then((res) => {
        if (!cancelled) setWhepAuthKey(res.whepAuthKey);
      })
      .catch(() => {
        // Not fatal - the URL itself still works when no key is required,
        // and members without admin/producer rights simply won't see one.
      });
    return () => {
      cancelled = true;
    };
  }, [productionId]);

  const generateUrl = useCallback(() => {
    if (username.trim()) {
      const url = generateWhepUrl(productionId, lineId, username.trim());
      setWhepUrl(url);
    } else {
      setWhepUrl("");
    }
  }, [username, productionId, lineId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    generateUrl();
  }, [generateUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    generateUrl();
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  return (
    <Modal onClose={onClose} title="Generate WHEP URL">
      <div ref={modalRef}>
        <ModalText>
          Enter a username to generate a WHEP URL for connecting to the server.
        </ModalText>
        <ModalNoteWrapper>
          <ModalTextBold>Note:</ModalTextBold>
          <ModalTextItalic>
            This URL is tied to the username and will update if you refresh.
          </ModalTextItalic>
        </ModalNoteWrapper>

        <Wrapper>
          <InputWrapper>
            <LinkLabel>
              <DecorativeLabel>WHEP URL</DecorativeLabel>
              <CombinedInputWrapper>
                <span>{generateWhepUrl(productionId, lineId, "")}</span>
                <input
                  aria-label="WHEP username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                />
              </CombinedInputWrapper>
            </LinkLabel>
            <CopyButton
              urls={[whepUrl]}
              className="share-line-link-modal"
              disabled={!whepUrl}
            />
          </InputWrapper>
        </Wrapper>

        {whepAuthKey && (
          <Wrapper>
            <InputWrapper>
              <LinkLabel>
                <DecorativeLabel>WHEP Auth Key</DecorativeLabel>
                <CombinedInputWrapper>
                  <input
                    aria-label="WHEP auth key"
                    value={whepAuthKey}
                    readOnly
                  />
                </CombinedInputWrapper>
              </LinkLabel>
              <CopyButton
                urls={[whepAuthKey]}
                className="share-line-link-modal"
              />
            </InputWrapper>
            <ModalNoteWrapper>
              <ModalTextBold>Note:</ModalTextBold>
              <ModalTextItalic>
                This server requires this key as a Bearer token
                (&quot;Authorization: Bearer &lt;key&gt;&quot;) to connect via
                WHEP - enter it in your WHEP client&apos;s auth/token field.
              </ModalTextItalic>
            </ModalNoteWrapper>
          </Wrapper>
        )}

        <RefreshButton
          label="Refresh URL"
          isLoading={isLoading}
          onRefresh={handleRefresh}
        />
      </div>
    </Modal>
  );
};
