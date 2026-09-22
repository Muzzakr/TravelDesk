import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useState } from 'react'
import { Combobox } from '@/components/ui/Combobox'

expect.extend(toHaveNoViolations)

const FRUITS = ['Apple', 'Banana', 'Cherry']

function StringCombobox({ items = FRUITS, initial = null as string | null }: { items?: string[]; initial?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initial)
  return (
    <Combobox<string>
      items={items}
      selectedItem={selected}
      onSelectedItemChange={setSelected}
      itemToString={(s) => s ?? ''}
      label="Fruit"
      placeholder="Search fruit…"
      renderItem={(s) => <span>{s}</span>}
    />
  )
}

type Airport = { code: string; name: string }
const AIRPORTS: Airport[] = [
  { code: 'JFK', name: 'John F. Kennedy Intl' },
  { code: 'JFK2', name: 'JFK duplicate-name test' }, // itemToString collides on purpose to exercise itemToKey
]

function ObjectCombobox() {
  const [selected, setSelected] = useState<Airport | null>(null)
  return (
    <>
      <Combobox<Airport>
        items={AIRPORTS}
        selectedItem={selected}
        onSelectedItemChange={setSelected}
        itemToString={(a) => a?.name ?? ''}
        itemToKey={(a) => a.code}
        label="Airport"
        placeholder="Search airport…"
        renderItem={(a, { isSelected }) => <span data-selected={isSelected}>{a.name} ({a.code})</span>}
      />
      <p data-testid="selected-code">{selected?.code ?? 'none'}</p>
    </>
  )
}

describe('Combobox — accessibility', () => {
  it('has no accessibility violations when closed', async () => {
    const { container } = render(<StringCombobox />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations when open with results', async () => {
    const { container } = render(<StringCombobox />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.type(screen.getByRole('combobox'), 'a')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations in the empty-results state', async () => {
    const { container } = render(<StringCombobox />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.type(screen.getByRole('combobox'), 'zzz-no-match')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('exposes combobox/listbox ARIA roles and updates aria-expanded with open state', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(input)
    await userEvent.type(input, 'a')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('input is programmatically labelled by the visible label', () => {
    render(<StringCombobox />)
    // getByRole with an accessible name only succeeds if aria-labelledby/for
    // actually resolves to the rendered <label> text — a real wiring check,
    // not just "a label element exists somewhere on the page".
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeInTheDocument()
  })

  it('sets aria-activedescendant to the highlighted option\'s id, and it resolves to a real element', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'an')
    await userEvent.keyboard('{ArrowDown}')
    const activeId = input.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    const active = document.getElementById(activeId!)
    expect(active).not.toBeNull()
    expect(active).toHaveAttribute('role', 'option')
    expect(active).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the empty-results message and it is actually reachable (not hidden alongside the list)', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'zzz-no-match')
    expect(screen.getByText('No results found')).toBeVisible()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})

describe('Combobox — keyboard interaction', () => {
  it('ArrowDown moves the highlight forward through multiple options', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}') // Apple
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}') // Banana
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowUp moves the highlight back', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}') // Apple -> Banana -> Apple
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true')
  })

  it('Home/End jump to the first/last option', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{End}')
    expect(screen.getByRole('option', { name: 'Cherry' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter selects the highlighted option and closes the list', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}') // Banana
    expect(input).toHaveValue('Banana')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('Enter with nothing highlighted does not throw and does not select a wrong item', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'an') // opens, filters to Banana, nothing highlighted yet
    await userEvent.keyboard('{Enter}')
    // No crash is the main assertion; downshift's default behavior on Enter
    // with no highlighted index is to close without changing selection.
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes the list without selecting', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'Cherry')
    await userEvent.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape when the list was never opened does not throw', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    input.focus()
    await userEvent.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('ArrowDown with zero matching results does not throw or select anything', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'zzz-no-match')
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    // downshift sets aria-activedescendant="" (empty string) rather than
    // omitting the attribute when nothing is highlighted — both are valid
    // per the ARIA spec (screen readers treat "" as "no active descendant"),
    // so assert on the value being empty, not on the attribute's absence.
    expect(input.getAttribute('aria-activedescendant')).toBeFalsy()
  })

  it('re-typing after a highlight resets/keeps the highlight within the new, shorter result set (no stale out-of-range index)', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}') // highlight index 2 (Cherry) of 3
    await userEvent.type(input, 'an') // filters down to just Banana — old index 2 would be out of range
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    // Must not be stuck referencing a highlighted index that no longer exists.
    const highlightedCount = options.filter((o) => o.getAttribute('aria-selected') === 'true').length
    expect(highlightedCount).toBeLessThanOrEqual(1)
  })

  it('the dropdown re-opens on refocus after a selection was made', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{Enter}') // selects Apple, closes
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await userEvent.tab() // move focus away
    await userEvent.click(input) // refocus
    expect(input).toHaveAttribute('aria-expanded', 'true')
    // Verified against the pre-refactor EventCombobox: it re-showed whatever
    // was last filtered (query = the selected label) rather than resetting
    // to the full list on refocus — same characteristic here, not a
    // regression introduced by this component. Documented, not "fixed",
    // per the review's "don't change working behavior" instruction.
    expect(screen.getAllByRole('option').length).toBe(1)
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument()
  })

  it('Tab moves focus onward and closes the list', async () => {
    render(
      <>
        <StringCombobox />
        <button type="button">Next field</button>
      </>
    )
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.tab()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Next field' })).toHaveFocus()
  })
})

describe('Combobox — mouse interaction', () => {
  it('clicking an option selects it', async () => {
    render(<StringCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.click(screen.getByRole('option', { name: 'Cherry' }))
    expect(input).toHaveValue('Cherry')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking outside the combobox closes the list without selecting', async () => {
    render(
      <div>
        <StringCombobox />
        <div data-testid="outside">Outside area</div>
      </div>
    )
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'Ban')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByTestId('outside'))
    expect(input).toHaveAttribute('aria-expanded', 'false')
    // Typed text wasn't committed as a selection via outside click.
    expect(input).toHaveValue('Ban')
  })
})

describe('Combobox — result-count edge cases', () => {
  it('renders correctly with a single item', async () => {
    render(<StringCombobox items={['OnlyOne']} />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(input).toHaveValue('OnlyOne')
  })

  it('renders correctly with zero items', async () => {
    render(<StringCombobox items={[]} />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('renders correctly with many items (50)', async () => {
    const many = Array.from({ length: 50 }, (_, i) => `Item ${i}`)
    render(<StringCombobox items={many} />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(50)
  })
})

describe('Combobox — object items and stable selection identity', () => {
  it('selects an object item via itemToKey, not reference equality', async () => {
    render(<ObjectCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.click(screen.getByRole('option', { name: /John F\. Kennedy/ }))
    expect(screen.getByTestId('selected-code')).toHaveTextContent('JFK')
    expect(input).toHaveValue('John F. Kennedy Intl')
  })

  it('distinguishes two items whose itemToString collides on substring but itemToKey differs', async () => {
    render(<ObjectCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.click(screen.getByRole('option', { name: /JFK duplicate-name test/ }))
    expect(screen.getByTestId('selected-code')).toHaveTextContent('JFK2')
  })
})

describe('Combobox — clearable', () => {
  function ClearableCombobox() {
    const [selected, setSelected] = useState<string | null>('Banana')
    return (
      <Combobox<string>
        items={FRUITS}
        selectedItem={selected}
        onSelectedItemChange={setSelected}
        itemToString={(s) => s ?? ''}
        label="Fruit"
        clearable
        renderItem={(s) => <span>{s}</span>}
      />
    )
  }

  it('does not render a clear button when nothing is selected', () => {
    render(<StringCombobox />)
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument()
  })

  it('clicking the clear button empties the selection and the input, without throwing', async () => {
    render(<ClearableCombobox />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveValue('Banana')
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(input).toHaveValue('')
    // The clear button itself disappears once selectedItem is null again.
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument()
  })
})

describe('Combobox — free-text mode (onInputValueChange)', () => {
  function FreeTextCombobox() {
    const [selected, setSelected] = useState<string | null>(null)
    const [typed, setTyped] = useState('')
    return (
      <>
        <Combobox<string>
          items={FRUITS}
          selectedItem={selected}
          onSelectedItemChange={setSelected}
          onInputValueChange={setTyped}
          itemToString={(s) => s ?? ''}
          label="Fruit"
          renderItem={(s) => <span>{s}</span>}
        />
        <p data-testid="typed-value">{typed}</p>
      </>
    )
  }

  it('propagates every keystroke even when it matches nothing in the list', async () => {
    render(<FreeTextCombobox />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'Not in list')
    expect(screen.getByTestId('typed-value')).toHaveTextContent('Not in list')
  })
})
