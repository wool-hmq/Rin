import { t } from "i18next";
import { useState } from "react";
import { useLocation } from "wouter";
import { Modal } from "@rin/ui";
import { ButtonWithLoading } from "../components/button";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { client } from "../app/runtime";

export function TotpRecoveryPage() {
    const [, setLocation] = useLocation();
    const [modalOpen, setModalOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [recoveryCode, setRecoveryCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleRecover = async () => {
        if (!username || !recoveryCode) {
            setError(t("totp_recovery.error.empty"));
            return;
        }
        setIsLoading(true);
        setError("");
        try {
            const { data, error: apiError } = await client.auth.recoverTotp({ username, recoveryCode });
            if (apiError) {
                setError(t("totp_recovery.error.invalid"));
                setIsLoading(false);
                return;
            }
            if (data?.success) {
                setSuccess(t("totp_recovery.success"));
                setRecoveryCode("");
            } else {
                setError(t("totp_recovery.error.invalid"));
            }
        } catch (err) {
            setError(t("totp_recovery.error.network"));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-6 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t('totp_recovery.title')}</p>
                <p className="text-sm t-secondary">{t('totp_recovery.description')}</p>

                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-500">{success}</p>}

                {/* Option 1: recover with recovery code */}
                <button
                    onClick={() => {
                        setError("");
                        setSuccess("");
                        setModalOpen(true);
                    }}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 p-4 text-left hover:bg-w-secondary transition-colors"
                >
                    <p className="text-sm font-medium t-primary">{t('totp_recovery.option_recover_title')}</p>
                    <p className="text-xs t-secondary mt-1">{t('totp_recovery.option_recover_desc')}</p>
                </button>

                {/* Option 2: contact admin (no-op as designed) */}
                <button
                    disabled={isLoading}
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 p-4 text-left hover:bg-w-secondary transition-colors"
                >
                    <p className="text-sm font-medium t-primary">{t('totp_recovery.option_admin_title')}</p>
                    <p className="text-xs t-secondary mt-1">{t('totp_recovery.option_admin_desc')}</p>
                </button>

                <div className="pt-2">
                    <Icon label={t('login.back')} name="ri-arrow-left-line" onClick={() => setLocation('/login')} hover={true} />
                </div>
            </div>

            <Modal
                isOpen={modalOpen}
                onRequestClose={() => {
                    if (!isLoading) {
                        setModalOpen(false);
                    }
                }}
                contentLabel={t('totp_recovery.option_recover_title')}
            >
                <div className="flex w-full flex-col gap-4 p-6">
                    <h2 className="text-lg font-bold t-primary">{t('totp_recovery.modal_title')}</h2>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium t-secondary">{t('totp_recovery.username_label')}</label>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t('login.username.placeholder')}
                            disabled={isLoading}
                            autofocus
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium t-secondary">{t('totp_recovery.code_label')}</label>
                        <Input
                            value={recoveryCode}
                            setValue={(value) => setRecoveryCode(value.toUpperCase())}
                            placeholder={t('totp_recovery.code_placeholder')}
                            disabled={isLoading}
                            onSubmit={handleRecover}
                        />
                        <p className="text-xs t-secondary">{t('totp_recovery.code_hint')}</p>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {success && <p className="text-sm text-green-500">{success}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setModalOpen(false)}
                            disabled={isLoading}
                            className="rounded-lg px-4 py-2 text-sm t-secondary"
                        >
                            {t('cancel')}
                        </button>
                        <ButtonWithLoading
                            title={isLoading ? t("login.loading") : t('totp_recovery.submit')}
                            onClick={handleRecover}
                            loading={isLoading}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
