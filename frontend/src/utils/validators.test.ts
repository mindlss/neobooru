import { describe, expect, it } from 'vitest'
import {
  emailValidator,
  maxLengthValidator,
  minLengthValidator,
  passwordValidator,
  requiredValidator,
} from './validators'

describe('validators', () => {
  it('validates email shape and required value', () => {
    expect(emailValidator('')).toBe('Email обязателен')
    expect(emailValidator('wrong')).toBe('Введите корректный email')
    expect(emailValidator('user@example.com')).toBe('')
  })

  it('validates password complexity', () => {
    expect(passwordValidator('')).toBe('Пароль обязателен')
    expect(passwordValidator('short')).toBe('Минимум 6 символов')
    expect(passwordValidator('password1!')).toBe('Добавьте заглавную букву')
    expect(passwordValidator('PASSWORD1!')).toBe('Добавьте строчную букву')
    expect(passwordValidator('Password!')).toBe('Добавьте цифру')
    expect(passwordValidator('Password1')).toBe(
      'Добавьте специальный символ (!@#$%^&*-_)',
    )
    expect(passwordValidator('Password1!')).toBe('')
  })

  it('validates required and length boundaries', () => {
    expect(requiredValidator(' ', 'Имя')).toBe('Имя обязательно для заполнения')
    expect(requiredValidator('value', 'Имя')).toBe('')
    expect(minLengthValidator('abc', 4, 'Имя')).toBe(
      'Имя должно содержать минимум 4 символов',
    )
    expect(minLengthValidator('abcd', 4, 'Имя')).toBe('')
    expect(maxLengthValidator('abcde', 4, 'Имя')).toBe(
      'Имя не должно превышать 4 символов',
    )
    expect(maxLengthValidator('abcd', 4, 'Имя')).toBe('')
  })
})
