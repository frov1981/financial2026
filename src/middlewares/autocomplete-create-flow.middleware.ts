import { NextFunction, Request, Response } from 'express'

type AutocompleteCreateContext = {
  returnTo: string
  token: string
  field: string
}

type AutocompleteResumeContext = {
  token: string
  field: string
  label: string
}

const readContext = (source: Record<string, unknown>): AutocompleteCreateContext | null => {
  const return_to = source.autocomplete_return_to
  const token = source.autocomplete_return_token
  const field = source.autocomplete_return_field

  if (
    typeof return_to !== 'string' ||
    return_to.length > 2048 ||
    !return_to.startsWith('/') ||
    return_to.startsWith('//') ||
    return_to.includes('\\') ||
    typeof token !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(token) ||
    typeof field !== 'string' ||
    !/^[a-zA-Z0-9_]+$/.test(field)
  ) {
    return null
  }

  const parsed_return_to = new URL(return_to, 'http://localhost')
  if (parsed_return_to.origin !== 'http://localhost') return null

  return { returnTo: `${parsed_return_to.pathname}${parsed_return_to.search}`, token, field }
}

export const autocompleteCreateFlowMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const query_context = readContext(req.query as Record<string, unknown>)
  const body_context = readContext((req.body || {}) as Record<string, unknown>)
  const create_context = req.method === 'POST' ? body_context : query_context

  res.locals.autocompleteCreateContext = create_context

  const token = req.query.autocomplete_resume
  const field = req.query.autocomplete_field
  const label = req.query.autocomplete_label
  res.locals.autocompleteResume = (
    typeof token === 'string' &&
    /^[a-f0-9-]{36}$/i.test(token) &&
    typeof field === 'string' &&
    /^[a-zA-Z0-9_]+$/.test(field) &&
    typeof label === 'string' &&
    label.length <= 255
  ) ? { token, field, label } as AutocompleteResumeContext : null

  const original_redirect = res.redirect.bind(res)
  res.redirect = ((status_or_url: number | string, url?: string) => {
    if (
      req.method === 'POST' &&
      req.body?.mode === 'insert' &&
      body_context &&
      (typeof status_or_url === 'string' || typeof url === 'string')
    ) {
      const body = req.body as Record<string, unknown>
      const label_value = typeof body.business_name === 'string'
        ? body.business_name.trim()
        : typeof body.name === 'string' ? body.name.trim() : ''
      const return_url = new URL(body_context.returnTo, 'http://localhost')
      return_url.searchParams.set('autocomplete_resume', body_context.token)
      return_url.searchParams.set('autocomplete_field', body_context.field)
      return_url.searchParams.set('autocomplete_label', label_value.slice(0, 255))
      return original_redirect(return_url.pathname + return_url.search)
    }

    return typeof status_or_url === 'number'
      ? original_redirect(status_or_url, url as string)
      : original_redirect(status_or_url)
  }) as Response['redirect']

  next()
}
