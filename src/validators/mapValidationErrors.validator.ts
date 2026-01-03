import { ValidationError } from 'class-validator'

export function mapValidationErrors(errors: ValidationError[]) {
  const fieldErrors: Record<string, string> = {}

  errors.forEach(err => {
    if (err.constraints) {
      fieldErrors[err.property] = Object.values(err.constraints)[0]
    }

    if (err.children && err.children.length > 0) {
      err.children.forEach(child => {
        if (child.constraints) {
          fieldErrors[`${err.property}`] =
            Object.values(child.constraints)[0]
        }
      })
    }
  })

  return fieldErrors
}
