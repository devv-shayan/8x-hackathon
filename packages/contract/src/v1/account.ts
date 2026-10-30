import { z } from 'zod'

// DELETE /api/app/v1/account: delete the signed-in person's account now
// (Apple 5.1.1(v), Google Play). The account is whoever the bearer token
// belongs to, never an id from the request. A 200 means it is gone; anything
// else means it is not, and the app must say so rather than sign the person out.

export const deleteAccountResponse = z.object({ ok: z.literal(true) })

export type DeleteAccountResponse = z.infer<typeof deleteAccountResponse>
