import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

// Mutation from Day 185
const INVITE_USER_MUTATION = gql`
  mutation InviteUser($username: String!, $email: String!, $password: String!, $role: String!) {
    inviteUser(username: $username, email: $email, password: $password, role: $role) {
      user {
        id
        username
        role
      }
    }
  }
`;

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserInvited: () => void; // Function to refetch the user list
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onUserInvited }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ANALYST'); // Default to Analyst

  const [inviteUser, { loading, error }] = useMutation(INVITE_USER_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteUser({
        variables: { username, email, password, role },
      });
      onUserInvited(); // Refetch the list on the parent page
      onClose(); // Close the modal
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('ANALYST');
    } catch (e) {
      console.error("Failed to invite user:", e);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite New User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Username</label>
          <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Temporary Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Role</label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ANALYST">Analyst</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Inviting...' : 'Send Invite'}
          </Button>
        </div>

        {error && <p className="mt-2 text-sm text-hefaistos-accent-red">Error: {error.message}</p>}
      </form>
    </Modal>
  );
};