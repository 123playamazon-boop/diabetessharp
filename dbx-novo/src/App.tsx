import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { ClientLayout } from "./layouts/ClientLayout";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminHomePage } from "./pages/admin/AdminHomePage";
import { AdminOrdersPage } from "./pages/admin/AdminOrdersPage";
import { AdminPremiumPage } from "./pages/admin/AdminPremiumPage";
import { AdminReceiptsPage } from "./pages/admin/AdminReceiptsPage";
import { AdminStockPage } from "./pages/admin/AdminStockPage";
import { AdminVipGroupPage } from "./pages/admin/AdminVipGroupPage";
import { AdminAssistedPurchasesPage } from "./pages/admin/AdminAssistedPurchasesPage";
import { ClientDashboardPage } from "./pages/client/ClientDashboardPage";
import { ClientInventoryPage } from "./pages/client/ClientInventoryPage";
import { ClientCreateShipmentPage } from "./pages/client/ClientCreateShipmentPage";
import { ClientEntrarPage } from "./pages/client/ClientEntrarPage";
import { ClientOrdersPage } from "./pages/client/ClientOrdersPage";
import { ClientFbaMasterLabelsPage } from "./pages/client/ClientFbaMasterLabelsPage";
import { ClientFbaShippingGuidePage } from "./pages/client/ClientFbaShippingGuidePage";
import { ClientPremiumLandingPage } from "./pages/client/ClientPremiumLandingPage";
import { ClientRegisterProductPage } from "./pages/client/ClientRegisterProductPage";
import { ClientAssistedPurchasePage } from "./pages/client/ClientAssistedPurchasePage";
import { ClientVipGroupPage } from "./pages/client/ClientVipGroupPage";
import { PlaceholderPage } from "./pages/client/PlaceholderPage";
import { ClientFinancialPage } from "./pages/client/ClientFinancialPage";
import { ClientStatementPage } from "./pages/client/ClientStatementPage";
import { ClientNotificationsPage } from "./pages/client/ClientNotificationsPage";
import { ClientFeesHelpPage } from "./pages/client/ClientFeesHelpPage";
import { ClientSupportPage } from "./pages/client/ClientSupportPage";
import { ClientAmazonLeadsPage } from "./pages/client/ClientAmazonLeadsPage";
import { ClientAmazonLeadsProLandingPage } from "./pages/client/ClientAmazonLeadsProLandingPage";
import { AmazonLeadsProPublicPage } from "./pages/AmazonLeadsProPublicPage";
import { RepriceProPublicPage } from "./pages/RepriceProPublicPage";
import { AiListingProductPublicPage } from "./pages/AiListingProductPublicPage";
import { LandingPage } from "./pages/LandingPage";
import { ClientProtectedShell } from "./layouts/ClientProtectedShell";
import { AdminSupportPage } from "./pages/admin/AdminSupportPage";
import { AdminAmazonLeadsPage } from "./pages/admin/AdminAmazonLeadsPage";
import { AdminAmazonLeadsProPage } from "./pages/admin/AdminAmazonLeadsProPage";
import { AdminRepriceProPage } from "./pages/admin/AdminRepriceProPage";
import { AdminAiListingPlansPage } from "./pages/admin/AdminAiListingPlansPage";
import { AdminBundleOrdersPage } from "./pages/admin/AdminBundleOrdersPage";
import { AdminGrowthProgramPage } from "./pages/admin/AdminGrowthProgramPage";
import { RepriceModuleLayout } from "./pages/client/reprice/RepriceModuleLayout";
import { RepriceDashboardPage } from "./pages/client/reprice/RepriceDashboardPage";
import { RepriceListingsPage } from "./pages/client/reprice/RepriceListingsPage";
import { RepriceOrdersPage } from "./pages/client/reprice/RepriceOrdersPage";
import { RepriceStrategiesPage } from "./pages/client/reprice/RepriceStrategiesPage";
import { RepriceTemplatesPage } from "./pages/client/reprice/RepriceTemplatesPage";
import { ClientGrowthProgramLandingPage } from "./pages/client/ClientGrowthProgramLandingPage";
import { ClientGrowthProgramDashboardPage } from "./pages/client/ClientGrowthProgramDashboardPage";
import { ClientGrowthStrategyAiPage } from "./pages/client/ClientGrowthStrategyAiPage";
import { ClientAiListingGeneratorPage } from "./pages/client/ClientAiListingGeneratorPage";
import { ClientListingAnalysisPage } from "./pages/client/ClientListingAnalysisPage";
import { ClientImproveListingPage } from "./pages/client/ClientImproveListingPage";
import { ClientListingCompliancePage } from "./pages/client/ClientListingCompliancePage";
import { ClientListingMultiPlatformPage } from "./pages/client/ClientListingMultiPlatformPage";
import { ClientToolsHubPage } from "./pages/client/ClientToolsHubPage";
import { ClientProductHunterPage } from "./pages/client/ClientProductHunterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/direct-leads-pro" element={<AmazonLeadsProPublicPage />} />
      <Route path="/dbx-reprice" element={<RepriceProPublicPage />} />
      <Route path="/ai-listing-plans" element={<AiListingProductPublicPage />} />

      <Route path="/app/entrar" element={<ClientEntrarPage />} />

      <Route path="/app" element={<ClientProtectedShell />}>
        <Route element={<ClientLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboardPage />} />
        <Route path="estoque" element={<ClientInventoryPage />} />
        <Route path="kits" element={<Navigate to="/app/pedidos/criar?tipo=prep_kit" replace />} />
        <Route path="montagem-kits" element={<Navigate to="/app/pedidos/criar?tipo=prep_kit" replace />} />
        <Route path="pedidos/criar" element={<ClientCreateShipmentPage />} />
        <Route path="pedidos/:orderId/fba-caixa-master" element={<ClientFbaMasterLabelsPage />} />
        <Route path="pedidos" element={<ClientOrdersPage />} />
        <Route path="guia-envio-fba" element={<ClientFbaShippingGuidePage />} />
        <Route path="cadastro-produto" element={<ClientRegisterProductPage />} />
        <Route path="premium" element={<ClientPremiumLandingPage />} />
        <Route path="financial" element={<ClientFinancialPage />} />
        <Route path="extrato" element={<ClientStatementPage />} />
        <Route path="notificacoes" element={<ClientNotificationsPage />} />
        <Route path="taxas" element={<ClientFeesHelpPage />} />
        <Route path="suporte" element={<ClientSupportPage />} />
        <Route path="leads-amazon" element={<ClientAmazonLeadsPage />} />
        <Route path="direct-leads-pro" element={<ClientAmazonLeadsProLandingPage />} />
        <Route path="reprice" element={<RepriceModuleLayout />}>
          <Route index element={<Navigate to="painel" replace />} />
          <Route path="painel" element={<RepriceDashboardPage />} />
          <Route path="anuncios" element={<RepriceListingsPage />} />
          <Route path="encomendas-amazon" element={<RepriceOrdersPage />} />
          <Route path="estrategias" element={<RepriceStrategiesPage />} />
          <Route path="modelos" element={<RepriceTemplatesPage />} />
        </Route>
        <Route path="reports" element={<PlaceholderPage title="Reports" subtitle="Prepared units and financial rollups." />} />
        <Route path="training" element={<PlaceholderPage title="Training" subtitle="Lives, SOPs, and onboarding content." />} />
        <Route path="grupo-vip" element={<ClientVipGroupPage />} />
        <Route path="loja" element={<ClientAssistedPurchasePage />} />
        <Route path="growth-program" element={<ClientGrowthProgramLandingPage />} />
        <Route path="growth-program/strategy-ai" element={<ClientGrowthStrategyAiPage />} />
        <Route path="growth-program/dashboard" element={<ClientGrowthProgramDashboardPage />} />
        <Route path="tools" element={<ClientToolsHubPage />} />
        <Route path="listing-generator" element={<ClientAiListingGeneratorPage />} />
        <Route path="listing-analysis" element={<ClientListingAnalysisPage />} />
        <Route path="improve-listing" element={<ClientImproveListingPage />} />
        <Route path="listing-compliance" element={<ClientListingCompliancePage />} />
        <Route path="listing-multi-platform" element={<ClientListingMultiPlatformPage />} />
        <Route path="product-hunter" element={<ClientProductHunterPage />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" subtitle="Profile, plan, language, and notifications." />} />
        </Route>
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHomePage />} />
        <Route path="estoque" element={<AdminStockPage />} />
        <Route path="clientes" element={<AdminClientsPage />} />
        <Route path="assinaturas-premium" element={<AdminPremiumPage />} />
        <Route path="leads-amazon" element={<AdminAmazonLeadsPage />} />
        <Route path="assinaturas-leads-pro" element={<AdminAmazonLeadsProPage />} />
        <Route path="assinaturas-reprice-pro" element={<AdminRepriceProPage />} />
        <Route path="assinaturas-listagens-ia" element={<AdminAiListingPlansPage />} />
        <Route path="recebimentos" element={<AdminReceiptsPage />} />
        <Route path="pedidos" element={<AdminOrdersPage />} />
        <Route path="kitagem" element={<AdminBundleOrdersPage />} />
        <Route path="grupo-vip" element={<AdminVipGroupPage />} />
        <Route path="loja" element={<AdminAssistedPurchasesPage />} />
        <Route path="growth-program" element={<AdminGrowthProgramPage />} />
        <Route path="suporte" element={<AdminSupportPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
