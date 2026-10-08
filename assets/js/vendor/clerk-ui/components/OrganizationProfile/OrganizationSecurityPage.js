import { useEnvironment } from "../../contexts/EnvironmentContext.js";
import { localizationKeys } from "../../localization/localizationKeys.js";
import { useProtect } from "../../common/Gate.js";
import { descriptors } from "../../customizables/elementDescriptors.js";
import { Col, Flex, Spinner } from "../../customizables/index.js";
import { Header } from "../../elements/Header.js";
import { ProfileCard } from "../../elements/ProfileCard/index.js";
import { ConfigureDirectorySyncWizard } from "../ConfigureDirectorySync/ConfigureDirectorySyncWizard.js";
import { SecurityDirectorySyncSection } from "../ConfigureDirectorySync/SecurityDirectorySyncSection.js";
import { ConfigureSSOWizard } from "../ConfigureSSO/ConfigureSSOWizard.js";
import { useOrganizationEnterpriseConnection } from "../ConfigureSSO/hooks/useOrganizationEnterpriseConnection.js";
import { SecurityBackControl } from "./SecurityBackControl.js";
import { EnterpriseConnectionPage } from "./EnterpriseConnectionPage/index.js";
import { SecuritySSOBypassSection } from "./SecuritySSOBypassSection.js";
import { SecuritySsoSection } from "./SecuritySsoSection.js";
import { SSOBypassAllowlistPage } from "./SSOBypassAllowlistPage.js";
import React, { useState } from "react";
import { useOrganization } from "@clerk/shared/react";
import { jsx, jsxs } from "@emotion/react/jsx-runtime";

//#region src/components/OrganizationProfile/OrganizationSecurityPage.tsx
const OrganizationSecurityPage = ({ contentRef }) => {
	const { organization } = useOrganization();
	if (!organization) return null;
	return /* @__PURE__ */ jsx(OrganizationSecurityPageContent, { contentRef });
};
const OrganizationSecurityPageContent = ({ contentRef }) => {
	const canManageConnections = useProtect({ permission: "org:sys_entconns:manage" });
	const canManageSSOBypass = useProtect({ permission: "org:sys_entconns_sso_bypass:manage" });
	const { organization, isLoading, enterpriseConnection, enterpriseConnections, selectConnection, connectionDomains, setConnectionDomains, claimedDomains, organizationEnterpriseConnection, testRuns, enterpriseConnectionMutations, organizationDomains, organizationDomainMutations } = useOrganizationEnterpriseConnection({ manage: canManageConnections });
	const { userSettings } = useEnvironment();
	const showDirectorySync = canManageConnections && userSettings.enterpriseSSO.self_serve_directory_sync;
	const showSSOBypass = canManageSSOBypass && enterpriseConnections.length > 0;
	const [requestedView, setRequestedView] = useState({ kind: "overview" });
	const exitToOverview = () => setRequestedView({ kind: "overview" });
	const openWizard = (scope, forceInitialStep = false) => {
		selectConnection(scope);
		setRequestedView({
			kind: "wizard",
			forceInitialStep
		});
	};
	const openConnection = (id) => setRequestedView({
		kind: "connection",
		id
	});
	const openedConnection = requestedView.kind === "connection" ? enterpriseConnections.find((connection) => connection.id === requestedView.id) : void 0;
	const view = requestedView.kind === "connection" && !openedConnection ? { kind: "overview" } : requestedView;
	if (isLoading && view.kind === "overview") return /* @__PURE__ */ jsx(SecurityPageOverview, {
		fillHeight: true,
		children: /* @__PURE__ */ jsx(Flex, {
			align: "center",
			justify: "center",
			sx: (t) => ({
				flex: 1,
				paddingBlock: t.space.$5
			}),
			children: /* @__PURE__ */ jsx(Spinner, {
				size: "xs",
				colorScheme: "neutral",
				elementDescriptor: descriptors.spinner
			})
		})
	});
	if (view.kind === "directorySync") return /* @__PURE__ */ jsx(ConfigureDirectorySyncWizard, {
		title: /* @__PURE__ */ jsx(SecurityBackControl, { onClick: exitToOverview }),
		onExit: exitToOverview
	});
	if (view.kind === "ssoBypass") return /* @__PURE__ */ jsx(SSOBypassAllowlistPage, { onBack: exitToOverview });
	if (view.kind === "connection" && openedConnection) return /* @__PURE__ */ jsx(EnterpriseConnectionPage, {
		connection: openedConnection,
		enterpriseConnectionMutations,
		onBack: exitToOverview
	});
	if (view.kind === "wizard") return /* @__PURE__ */ jsx(ConfigureSSOWizard, {
		organizationEnterpriseConnection,
		testRuns,
		enterpriseConnection,
		connectionDomains,
		setConnectionDomains,
		claimedDomains,
		contentRef,
		enterpriseConnectionMutations,
		organizationDomainMutations,
		organizationDomains,
		forceInitialStep: view.forceInitialStep,
		title: /* @__PURE__ */ jsx(SecurityBackControl, { onClick: exitToOverview }),
		onExit: exitToOverview
	});
	return /* @__PURE__ */ jsxs(SecurityPageOverview, { children: [
		/* @__PURE__ */ jsx(SecuritySsoSection, {
			enterpriseConnections,
			enterpriseConnectionMutations,
			organizationName: organization?.name ?? "",
			contentRef,
			onConfigure: canManageConnections ? openWizard : void 0,
			onOpenConnection: canManageConnections ? openConnection : void 0
		}),
		showSSOBypass && /* @__PURE__ */ jsx(SecuritySSOBypassSection, { onManage: () => setRequestedView({ kind: "ssoBypass" }) }),
		showDirectorySync && /* @__PURE__ */ jsx(SecurityDirectorySyncSection, {
			organizationName: organization?.name ?? "",
			contentRef,
			onConfigure: () => setRequestedView({ kind: "directorySync" })
		})
	] });
};
/**
* The overview's stable page chrome — the security `ProfileCard.Page` and its
* "Security" header. Both the settled overview and the on-mount loading state
* render through this, so the section body is the only thing that swaps in.
*
* `fillHeight` grows the page to the scroll box so the loading state's spinner
* can center in the remaining height beneath the header.
*/
const SecurityPageOverview = ({ children, fillHeight = false }) => /* @__PURE__ */ jsx(ProfileCard.Page, {
	sx: fillHeight ? { flex: 1 } : void 0,
	children: /* @__PURE__ */ jsx(Col, {
		elementDescriptor: descriptors.page,
		sx: (t) => ({
			gap: t.space.$8,
			...fillHeight && { flex: 1 }
		}),
		children: /* @__PURE__ */ jsxs(Col, {
			elementDescriptor: descriptors.profilePage,
			elementId: descriptors.profilePage.setId("organizationSecurity"),
			sx: fillHeight ? { flex: 1 } : void 0,
			children: [/* @__PURE__ */ jsx(Header.Root, { children: /* @__PURE__ */ jsx(Header.Title, {
				localizationKey: localizationKeys("organizationProfile.securityPage.title"),
				sx: (t) => ({ marginBottom: t.space.$4 }),
				textVariant: "h2"
			}) }), children]
		})
	})
});

//#endregion
export { OrganizationSecurityPage };
//# sourceMappingURL=OrganizationSecurityPage.js.map