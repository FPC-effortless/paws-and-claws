import { sortEnterpriseConnections } from "../ConfigureSSO/domain/organizationEnterpriseConnection.js";
import { DIRECTORY_SYNC_PROVIDERS, directorySyncProviderForConnection } from "./providerMeta.js";
import React from "react";
import { __internal_useOrganizationDirectorySync, __internal_useOrganizationEnterpriseConnections } from "@clerk/shared/react";
import { jsx } from "@emotion/react/jsx-runtime";

//#region src/components/ConfigureDirectorySync/ConfigureDirectorySyncContext.tsx
const ConfigureDirectorySyncContext = React.createContext(null);
ConfigureDirectorySyncContext.displayName = "ConfigureDirectorySyncContext";
const ConfigureDirectorySyncProvider = ({ onExit, children }) => {
	const { data: connections, isLoading: isLoadingConnections } = __internal_useOrganizationEnterpriseConnections();
	const connection = sortEnterpriseConnections(connections ?? [])[0];
	const enterpriseConnectionId = connection?.id ?? null;
	const { data: directory, isLoading: isLoadingDirectory, createDirectorySync, updateDirectorySync, rotateDirectorySyncToken, setDirectorySyncCredentials, syncDirectory } = __internal_useOrganizationDirectorySync({ enterpriseConnectionId });
	const [revealed, setRevealed] = React.useState(null);
	const revealedToken = revealed && revealed.enterpriseConnectionId === enterpriseConnectionId ? revealed.token : null;
	const revealFrom = (result) => {
		if (result?.apiKey) setRevealed({
			enterpriseConnectionId: result.enterpriseConnectionId,
			token: result.apiKey
		});
	};
	const createDirectory = React.useCallback(async () => {
		const created = await createDirectorySync();
		revealFrom(created);
		return created;
	}, [createDirectorySync]);
	const rotateToken = React.useCallback(async () => {
		const rotated = await rotateDirectorySyncToken();
		revealFrom(rotated);
		return rotated;
	}, [rotateDirectorySyncToken]);
	const setDirectoryEnabled = React.useCallback((enabled) => updateDirectorySync({ enabled }), [updateDirectorySync]);
	const provider = directory?.provider ?? (connection ? directorySyncProviderForConnection(connection.provider) : void 0);
	const value = {
		isLoading: isLoadingConnections || Boolean(enterpriseConnectionId) && isLoadingDirectory,
		connection,
		provider,
		providerMeta: provider ? DIRECTORY_SYNC_PROVIDERS[provider] : void 0,
		directory,
		revealedToken,
		createDirectory,
		rotateToken,
		setDirectoryEnabled,
		setCredentials: setDirectorySyncCredentials,
		syncDirectory,
		onExit
	};
	return /* @__PURE__ */ jsx(ConfigureDirectorySyncContext.Provider, {
		value,
		children
	});
};
const useConfigureDirectorySync = () => {
	const ctx = React.useContext(ConfigureDirectorySyncContext);
	if (!ctx) throw new Error("useConfigureDirectorySync called outside <ConfigureDirectorySyncProvider>.");
	return ctx;
};

//#endregion
export { ConfigureDirectorySyncProvider, useConfigureDirectorySync };
//# sourceMappingURL=ConfigureDirectorySyncContext.js.map