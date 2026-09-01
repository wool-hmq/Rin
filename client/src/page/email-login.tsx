import { t } from "i18next";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ButtonWithLoading } from "../components/button";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { client } from "../app/runtime";

type Step = "email" | "code";

export function EmailLoginPage() {
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [countdown, setCountdown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [, setLocation] = useLocation();

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = async () => {
        if (!email) {
            setError(t('email_login.error.email_required'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: apiError } = await client.auth.sendEmailCode({ email });

            if (apiError) {
                setError(typeof apiError.value === 'string' ? apiError.value : t('email_login.error.send_failed'));
                setIsLoading(false);
                return;
            }

            if (data?.success) {
                setStep("code");
                setCountdown(60);
            } else {
                setError(t('email_login.error.send_failed'));
            }
        } catch (err) {
            setError(t('email_login.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!code) {
            setError(t('email_login.error.code_required'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: apiError } = await client.auth.emailLogin({ email, code });

            if (apiError) {
                setError(typeof apiError.value === 'string' ? apiError.value : t('email_login.error.invalid'));
                setIsLoading(false);
                return;
            }

            if (data?.success) {
                window.location.href = "/";
                window.location.reload();
            } else {
                setError(t('email_login.error.failed'));
            }
        } catch (err) {
            setError(t('email_login.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t('email_login.title')}</p>

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                {step === "email" ? (
                    <>
                        <p className="text-sm t-secondary">{t('email_login.enter_email')}</p>
                        <Input
                            value={email}
                            setValue={setEmail}
                            placeholder={t('email_login.email_placeholder')}
                            disabled={isLoading}
                            type="email"
                            autofocus
                        />
                        <div className="flex flex-row items-center space-x-4 pt-2">
                            <ButtonWithLoading
                                title={isLoading ? t("login.loading") : t('email_login.send_code')}
                                onClick={handleSendCode}
                                loading={isLoading}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm t-secondary">{t('email_login.enter_code', { email })}</p>
                        <Input
                            value={code}
                            setValue={setCode}
                            placeholder={t('email_login.code_placeholder')}
                            disabled={isLoading}
                            autofocus
                        />
                        <div className="flex flex-row items-center space-x-4 pt-2">
                            <ButtonWithLoading
                                title={isLoading ? t("login.loading") : t('email_login.submit')}
                                onClick={handleLogin}
                                loading={isLoading}
                            />
                            {countdown > 0 && (
                                <p className="text-xs t-secondary">{t('email_login.resend_in', { seconds: countdown })}</p>
                            )}
                        </div>
                    </>
                )}

                <div className="pt-4">
                    <Icon label={t('login.back')} name="ri-arrow-left-line" onClick={() => setLocation('/login')} hover={true} />
                </div>
            </div>
        </div>
    );
}
