import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { credentialToJSON, parseAuthenticationOptions } from '../utils/webauthn';

const START_MFA_LOGIN_MUTATION = gql`
  mutation StartMfaLogin($username: String!, $password: String!) {
    startMfaLogin(username: $username, password: $password) {
      token
      mfaRequired
      challengeId
      message
      hasWebauthn
    }
  }
`;

const VERIFY_MFA_LOGIN_MUTATION = gql`
  mutation VerifyMfaLogin($challengeId: String!, $otpCode: String, $backupCode: String) {
    verifyMfaLogin(challengeId: $challengeId, otpCode: $otpCode, backupCode: $backupCode) {
      token
      ok
      message
    }
  }
`;

const START_WEBAUTHN_MFA_AUTH_MUTATION = gql`
  mutation StartWebauthnMfaAuthentication($loginChallengeId: String!) {
    startWebauthnMfaAuthentication(loginChallengeId: $loginChallengeId) {
      optionsJson
      webauthnChallengeId
    }
  }
`;

const VERIFY_WEBAUTHN_MFA_AUTH_MUTATION = gql`
  mutation VerifyWebauthnMfaAuthentication($loginChallengeId: String!, $webauthnChallengeId: String!, $credential: JSONString!) {
    verifyWebauthnMfaAuthentication(
      loginChallengeId: $loginChallengeId,
      webauthnChallengeId: $webauthnChallengeId,
      credential: $credential
    ) {
      ok
      token
    }
  }
`;

const START_PASSWORDLESS_LOGIN_MUTATION = gql`
  mutation StartPasswordlessLogin($username: String!) {
    startPasswordlessLogin(username: $username) {
      webauthnChallengeId
      optionsJson
    }
  }
`;

const VERIFY_PASSWORDLESS_LOGIN_MUTATION = gql`
  mutation VerifyPasswordlessLogin($webauthnChallengeId: String!, $credential: JSONString!) {
    verifyPasswordlessLogin(webauthnChallengeId: $webauthnChallengeId, credential: $credential) {
      ok
      token
    }
  }
`;

interface StartMfaLoginData {
  startMfaLogin: {
    token: string;
    mfaRequired: boolean;
    challengeId?: string;
    message?: string;
    hasWebauthn: boolean;
  };
}

interface StartMfaLoginVars {
  username: string;
  password: string;
}

interface VerifyMfaLoginData {
  verifyMfaLogin: {
    token: string;
    ok: boolean;
    message?: string;
  };
}

interface VerifyMfaLoginVars {
  challengeId: string;
  otpCode?: string;
  backupCode?: string;
}

interface StartWebAuthnMfaData {
  startWebauthnMfaAuthentication: { optionsJson: string; webauthnChallengeId: string };
}
interface VerifyWebAuthnMfaData {
  verifyWebauthnMfaAuthentication: { ok: boolean; token: string };
}
interface StartPasswordlessData {
  startPasswordlessLogin: { webauthnChallengeId: string; optionsJson: string };
}
interface VerifyPasswordlessData {
  verifyPasswordlessLogin: { ok: boolean; token: string };
}

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [hasWebauthn, setHasWebauthn] = useState(false);
  const { login } = useAuth();

  const [startMfaLogin, { loading: loginLoading, error: loginError }] = useMutation<StartMfaLoginData, StartMfaLoginVars>(START_MFA_LOGIN_MUTATION);
  const [verifyMfaLogin, { loading: verifyLoading, error: verifyError }] = useMutation<VerifyMfaLoginData, VerifyMfaLoginVars>(VERIFY_MFA_LOGIN_MUTATION);
  const [startWebauthnMfa] = useMutation<StartWebAuthnMfaData>(START_WEBAUTHN_MFA_AUTH_MUTATION);
  const [verifyWebauthnMfa] = useMutation<VerifyWebAuthnMfaData>(VERIFY_WEBAUTHN_MFA_AUTH_MUTATION);
  const [startPasswordless] = useMutation<StartPasswordlessData>(START_PASSWORDLESS_LOGIN_MUTATION);
  const [verifyPasswordless] = useMutation<VerifyPasswordlessData>(VERIFY_PASSWORDLESS_LOGIN_MUTATION);

  const loading = loginLoading || verifyLoading;
  const error = loginError || verifyError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const { data } = await startMfaLogin({
        variables: { username, password },
      });

      const result = data?.startMfaLogin;
      if (!result) return;
      if (result.token) {
        login(result.token);
      } else if (result.mfaRequired && result.challengeId) {
        setChallengeId(result.challengeId);
        setHasWebauthn(!!result.hasWebauthn);
        setMfaStep(true);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Login failed:', e);
    }
  };

  const handleWebAuthnMfa = async () => {
    try {
      const started = await startWebauthnMfa({ variables: { loginChallengeId: challengeId } });
      const optionsJson = started.data?.startWebauthnMfaAuthentication?.optionsJson;
      const webauthnChallengeId = started.data?.startWebauthnMfaAuthentication?.webauthnChallengeId;
      if (!optionsJson || !webauthnChallengeId) return;
      const credential = await navigator.credentials.get({
        publicKey: parseAuthenticationOptions(optionsJson),
      }) as PublicKeyCredential | null;
      if (!credential) return;
      const verified = await verifyWebauthnMfa({
        variables: {
          loginChallengeId: challengeId,
          webauthnChallengeId,
          credential: JSON.stringify(credentialToJSON(credential)),
        },
      });
      const token = verified.data?.verifyWebauthnMfaAuthentication?.token;
      if (token) login(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Security key MFA failed:', e);
    }
  };

  const handlePasswordless = async () => {
    try {
      const started = await startPasswordless({ variables: { username } });
      const optionsJson = started.data?.startPasswordlessLogin?.optionsJson;
      const webauthnChallengeId = started.data?.startPasswordlessLogin?.webauthnChallengeId;
      if (!optionsJson || !webauthnChallengeId) return;
      const credential = await navigator.credentials.get({
        publicKey: parseAuthenticationOptions(optionsJson),
      }) as PublicKeyCredential | null;
      if (!credential) return;
      const verified = await verifyPasswordless({
        variables: { webauthnChallengeId, credential: JSON.stringify(credentialToJSON(credential)) },
      });
      const token = verified.data?.verifyPasswordlessLogin?.token;
      if (token) login(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Passwordless login failed:', e);
    }
  };

  const handleVerifyMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const { data } = await verifyMfaLogin({
        variables: {
          challengeId,
          otpCode: showBackupCode ? undefined : otpCode,
          backupCode: showBackupCode ? backupCode : undefined,
        },
      });
      if (data?.verifyMfaLogin?.token) {
        login(data.verifyMfaLogin.token);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('MFA verification failed:', e);
    }
  };

  return (
    <div className="auth-shell">
      <Card className="auth-card" style={{ width: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="logo-title" style={{ display: 'block', fontSize: 32 }}>
            HEFAISTOS
          </span>
        </div>
        <Typography.Paragraph className="auth-subtitle">
          Detection Engineering Portal
        </Typography.Paragraph>
        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error.message} />
        )}
        {!mfaStep ? (
          <Form layout="vertical" onSubmitCapture={handleSubmit}>
            <Form.Item label="Username" required>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="large"
                autoFocus
                disabled={loading}
                placeholder="Enter your username"
              />
            </Form.Item>
            <Form.Item label="Password" required>
              <Input.Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="large"
                disabled={loading}
                placeholder="Enter your password"
              />
            </Form.Item>
            <Button
              type="default"
              htmlType="button"
              block
              size="large"
              style={{ marginTop: 8, fontWeight: 600 }}
              onClick={handlePasswordless}
              disabled={loading || !username}
            >
              Use Security Key (Passwordless)
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ marginTop: 8, fontWeight: 600 }}
            >
              {loading ? 'Signing In...' : 'Login'}
            </Button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Link to="/forgot-password" className="theme-link" style={{ fontSize: 13 }}>
                Forgot Password?
              </Link>
              <span className="theme-link" style={{ margin: '0 8px', fontSize: 13 }}>|</span>
              <Link to="/register" className="theme-link" style={{ fontSize: 13 }}>
                Register
              </Link>
            </div>
          </Form>
        ) : (
          <Form layout="vertical" onSubmitCapture={handleVerifyMfa}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Second factor required. Enter code from your authenticator app or a backup code."
            />
            {!showBackupCode ? (
              <Form.Item label="Authenticator code" required>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  size="large"
                  autoFocus
                  disabled={loading}
                  placeholder="6-digit code"
                />
              </Form.Item>
            ) : (
              <Form.Item label="Backup code" required>
                <Input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  size="large"
                  autoFocus
                  disabled={loading}
                  placeholder="Enter backup code"
                />
              </Form.Item>
            )}
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ marginTop: 8, fontWeight: 600 }}
            >
              {loading ? 'Verifying...' : 'Verify and Login'}
            </Button>
            {hasWebauthn && (
              <Button type="default" block size="large" style={{ marginTop: 8 }} onClick={handleWebAuthnMfa}>
                Use Security Key
              </Button>
            )}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Button type="link" onClick={() => setShowBackupCode(!showBackupCode)}>
                {showBackupCode ? 'Use authenticator code' : 'Use backup code'}
              </Button>
              <Button
                type="link"
                onClick={() => {
                  setMfaStep(false);
                  setChallengeId('');
                  setOtpCode('');
                  setBackupCode('');
                }}
              >
                Back
              </Button>
            </div>
          </Form>
        )}
        <Typography.Paragraph className="auth-footer">
          © {new Date().getFullYear()} HEFAISTOS Platform
        </Typography.Paragraph>
      </Card>
    </div>
  );
};
