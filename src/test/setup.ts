import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount React trees after every test to avoid cross-test leakage.
afterEach(() => {
  cleanup()
})
