import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';

const REDIRECT_DELAY_MS = 3000;

const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      ok
      message
    }
  }
`;

interface ResetPasswordData {
  resetPassword: {
    ok: boolean;
    message: string;
  };
}

interface ResetPasswordVars {
  token: string;
  newPassword: string;
}

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  const [resetPassword, { loading, error }] = useMutation<ResetPasswordData, ResetPasswordVars>(
    RESET_PASSWORD_MUTATION
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError('');

    if (!newPassword) {
      setValidationError('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (!token) {
      setValidationError('Missing reset token. Please use the link from your reset email.');
      return;
    }

    try {
      const { data } = await resetPassword({ variables: { token, newPassword } });
      if (data?.resetPassword?.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Reset password failed:', e);
    }
  };

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0b1221,#122b55 55%,#0b1221)' }}>
        <Card style={{ width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <Alert
            type="error"
            showIcon
            message="Invalid Reset Link"
            description="No reset token found. Please request a new password reset."
          />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/forgot-password" style={{ color: '#1677ff', fontSize: 14 }}>
              Request Password Reset
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0b1221,#122b55 55%,#0b1221)' }}>
      <Card style={{ width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="logo-title" style={{ display: 'block', fontSize: 32 }}>
            HEFAISTOS
          </span>
        </div>
        <Typography.Paragraph style={{ textAlign: 'center', marginBottom: 24, color: '#1677ff', fontSize: 14, fontWeight: 500 }}>
          Set New Password
        </Typography.Paragraph>

        {success ? (
          <div>
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message="Password reset successfully!"
              description="You can now log in with your new password. Redirecting to login..."
            />
            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#1677ff', fontSize: 14 }}>
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {(error || validationError) && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message={validationError || error?.message}
              />
            )}
            <Form layout="vertical" onSubmitCapture={handleSubmit}>
              <Form.Item label="New Password" required>
                <Input.Password
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  size="large"
                  autoFocus
                  disabled={loading}
                  placeholder="Enter your new password"
                />
              </Form.Item>
              <Form.Item label="Confirm New Password" required>
                <Input.Password
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  size="large"
                  disabled={loading}
                  placeholder="Confirm your new password"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{ marginTop: 8, fontWeight: 600 }}
              >
                {loading ? 'Resetting...' : 'Set New Password'}
              </Button>
            </Form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/login" style={{ color: '#1677ff', fontSize: 14 }}>
                ← Back to Login
              </Link>
            </div>
          </>
        )}

        <Typography.Paragraph style={{ marginTop: 24, fontSize: 12, textAlign: 'center', opacity: 0.65 }}>
          © {new Date().getFullYear()} HEFAISTOS Platform
        </Typography.Paragraph>
      </Card>
    </div>
  );
};
