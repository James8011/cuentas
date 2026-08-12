import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { LoginPage } from './LoginPage'

const loginMock = vi.fn()

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../services/api')>(
    '../../services/api',
  )
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn().mockResolvedValue(null),
      login: (...args: unknown[]) => loginMock(...args),
    },
  }
})

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
    loginMock.mockResolvedValue({
      user: {
        id: 1,
        name: 'Admin',
        phone: '+573001112233',
        email: null,
        status: 'active',
      },
      households: [],
    })
  })

  it('submits phone and password', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/teléfono/i), '3001112233')
    await user.type(screen.getByLabelText(/contraseña/i), 'DevAdmin123!')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(loginMock).toHaveBeenCalledWith('3001112233', 'DevAdmin123!')
  })
})
