import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import KnowledgeView from "~/views/knowledge";

const KnowledgePage: NextPageWithLayout = () => {
  return (
    <>
      <KnowledgeView />
      <Popup />
    </>
  );
};

KnowledgePage.getLayout = (page) => getDashboardLayout(page);

export default KnowledgePage;
