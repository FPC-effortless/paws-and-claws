import { useNavigateToFlowStart } from "../../hooks/useNavigateToFlowStart.js";
import { useCoreSignUp } from "../../contexts/CoreClientContext.js";
import { useCardState, withCardStateProvider } from "../../elements/contexts/index.js";
import { actionBlockedDetailsFrom } from "../../utils/actionBlocked.js";
import { ActionBlockedCard } from "../../common/ActionBlockedCard.js";
import { withRedirectToAfterSignUp } from "../../common/withRedirect.js";
import { useProtectCheckRunner } from "../../hooks/useProtectCheckRunner.js";
import { ProtectCheckCard } from "../ProtectCheck/ProtectCheckCard.js";
import { useCompleteSignUpFlow } from "./useCompleteSignUpFlow.js";
import { useEffect, useRef, useState } from "react";
import { jsx } from "@emotion/react/jsx-runtime";

//#region src/components/SignUp/SignUpProtectCheck.tsx
function SignUpProtectCheckInternal({ verifyEmailPath = "../verify-email-address", verifyPhonePath = "../verify-phone-number", continuePath = "../continue", protectCheckPath = "." } = {}) {
	const card = useCardState();
	const signUp = useCoreSignUp();
	const { navigateToFlowStart } = useNavigateToFlowStart();
	const completeSignUpFlow = useCompleteSignUpFlow();
	const [everSawProtectCheck, setEverSawProtectCheck] = useState(!!signUp.protectCheck);
	const didStartNoCheckFallbackRef = useRef(false);
	if (signUp.protectCheck && !everSawProtectCheck) setEverSawProtectCheck(true);
	useEffect(() => {
		if (!signUp.protectCheck && !everSawProtectCheck && !didStartNoCheckFallbackRef.current) {
			didStartNoCheckFallbackRef.current = true;
			navigateToFlowStart();
		}
	}, [
		everSawProtectCheck,
		navigateToFlowStart,
		signUp.protectCheck
	]);
	const runner = useProtectCheckRunner({
		getProtectCheck: () => signUp.protectCheck,
		getResource: () => signUp,
		reload: () => signUp.reload(),
		submitProtectCheck: (params) => signUp.submitProtectCheck(params),
		onResolved: async (updatedSignUp, isCancelled) => {
			if (isCancelled()) return;
			await completeSignUpFlow({
				signUp: updatedSignUp,
				verifyEmailPath,
				verifyPhonePath,
				protectCheckPath,
				continuePath
			});
		}
	});
	if (!signUp.protectCheck && !everSawProtectCheck) return null;
	const blockedDetails = actionBlockedDetailsFrom(card.rawError);
	if (blockedDetails) return /* @__PURE__ */ jsx(ActionBlockedCard, { details: blockedDetails });
	return /* @__PURE__ */ jsx(ProtectCheckCard, {
		flow: "signUp",
		runner
	});
}
const SignUpProtectCheck = withRedirectToAfterSignUp(withCardStateProvider(SignUpProtectCheckInternal));

//#endregion
export { SignUpProtectCheck };
//# sourceMappingURL=SignUpProtectCheck.js.map