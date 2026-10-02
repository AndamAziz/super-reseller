<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Credit deduction and line expiry run only in database functions (create_line, renew_line, adjust_credits) so balances can't be bypassed from the browser.
- Reseller accounts are created/deleted by admin-only server functions; public sign-up is disabled.
