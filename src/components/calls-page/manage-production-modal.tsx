import styled from "@emotion/styled";
import { useMemo } from "react";
import { useFetchProduction } from "../landing-page/use-fetch-production";
import { Modal } from "../modal/modal";
import { ProductionListExpandedContent } from "../production-list/production-list-expanded-content";
import { Spinner } from "../loader/loader";

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem 0;
`;

type ManageProductionModalProps = {
  productionId: string;
  onClose: () => void;
};

export const ManageProductionModal = ({
  productionId,
  onClose,
}: ManageProductionModalProps) => {
  const { production, loading } = useFetchProduction(Number(productionId));

  const totalParticipants = useMemo(() => {
    return (
      production?.lines
        ?.map((line) => line.participants.filter((p) => !p.isWhip).length || 0)
        .reduce((partialSum, a) => partialSum + a, 0) || 0
    );
  }, [production]);

  return (
    <Modal onClose={onClose} title="Manage Production">
      {!production && loading && (
        <LoadingWrapper>
          <Spinner className="production-list" />
        </LoadingWrapper>
      )}
      {production && (
        <ProductionListExpandedContent
          production={production}
          managementMode
          totalParticipants={totalParticipants}
        />
      )}
    </Modal>
  );
};
