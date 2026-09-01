import { t } from "i18next";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ButtonWithLoading } from "../components/button";
import { GiteeIcon } from "../components/gitee-icon";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { client, oauth_url } from "../app/runtime";
import { setAuthToken } from "../utils/auth";
import { getLoginRedirectPath } from "../utils/auth-redirect";

const gitee_oauth_url = oauth_url.replace('/github', '/gitee');
const qq_oauth_url = oauth_url.replace('/github', '/xinyueqq');

export function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [authStatus, setAuthStatus] = useState<{ github: boolean, gitee: boolean, qq: boolean, email: boolean, password: boolean }>({ github: false, gitee: false, qq: false, email: false, password: false });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    // Fetch auth status on mount
    useEffect(() => {
        client.auth.status().then(({ data }) => {
            if (data) {
                setAuthStatus(data);
            }
        });
    }, []);

    const handleLogin = async () => {
        if (!username || !password) {
            setError(t('login.error.empty'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: apiError } = await client.auth.login({ username, password });

            if (apiError) {
                setError(t('login.error.invalid'));
                setIsLoading(false);
                return;
            }

            if (data?.success) {
                // Save token to localStorage for cross-domain auth
                if (data.token) {
                    setAuthToken(data.token);
                }
                setLocation(getLoginRedirectPath(window.location.search));
                window.location.reload();
            } else {
                setError(t('login.error.failed'));
            }
        } catch (err) {
            setError(t('login.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t('login.title')}</p>

                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                {/* Password login form */}
                {authStatus.password && (
                    <>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t('login.username.placeholder')}
                            disabled={isLoading}
                            autofocus
                        />
                        <Input
                            value={password}
                            setValue={setPassword}
                            placeholder={t('login.password.placeholder')}
                            type="password"
                            onSubmit={handleLogin}
                            disabled={isLoading}
                        />
                        <div className="flex flex-row items-center space-x-4 pt-2">
                            <ButtonWithLoading
                                title={isLoading ? t("login.loading") : t("login.title")}
                                onClick={handleLogin}
                                loading={isLoading}
                            />
                        </div>
                    </>
                )}

                {/* OAuth options */}
                {(authStatus.github || authStatus.gitee || authStatus.qq || authStatus.email) && (
                    <div className="flex flex-col justify-center items-center space-y-2 pt-2">
                        {authStatus.password && <p className="text-xs t-secondary">{t('login.or')}</p>}
                        {(!authStatus.password && !authStatus.github && !authStatus.gitee && !authStatus.qq && !authStatus.email) && <p className="text-xs t-secondary">{t('login.oauth_only')}</p>}
                        <div className="flex flex-row items-center space-x-4">
                            {authStatus.github && (
                                <Icon label={t('github_login')} name="ri-github-line" onClick={() => {
                                    window.location.href = `${oauth_url}`
                                }} hover={true} />
                            )}
                            {authStatus.gitee && (
                                <GiteeIcon label={t('gitee_login')} onClick={() => {
                                    window.location.href = `${gitee_oauth_url}`
                                }} hover={true} />
                            )}
                            {authStatus.qq && (
                                <Icon label={t('qq_login')} name="ri-qq-line" onClick={() => {
                                    window.location.href = `${qq_oauth_url}`
                                }} hover={true} />
                            )}
                            {authStatus.email && (
                                <Icon label={t('email_login')} name="ri-mail-line" onClick={() => {
                                    setLocation('/email-login');
                                }} hover={true} />
                            )}
                        </div>
                    </div>
                )}

                {/* No auth methods available */}
                {!authStatus.github && !authStatus.gitee && !authStatus.password && !authStatus.qq && !authStatus.email && (
                    <p className="text-sm text-red-500">{t('login.no_methods')}</p>
                )}
            </div>
        </div>
    );
}
