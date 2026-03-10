# Test Plan

Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. Have a test plan that always exists. 

---

## Text

Long text that wraps with **bold** and *italic* and __bold__ and _italic_. Long text that wraps with **bold** and *italic* and __bold__ and _italic_. Long text that wraps with **bold** and *italic* and __bold__ and _italic_.

✅ Emoji
*Italic*
**Bold**
*Italic **BOLD** Italic*
**Bold *ITALIC* Bold**
Inner**bold**word
`Code`
`Code with ``escaped`` backticks`
~~Strikethrough~~
[https://link.com](https://link.com)

## List Items
Unordered

* Bullets
  * Indented

Ordered

1. Numbered
2. Lines

And

1. **Lists:**
   - With
   - Sub bullets

Checkboxes

- [ ] *Italic*
- [ ] **Bold**
- [ ] `Code`
- [ ] ✅ Emoji
- [x] Checked

## Extra

| File | Change Type | Description |
|------|-------------|-------------|
| `src/utils/markdown.ts` | NEW | Core markdown rendering with line mapping |
| `src/utils/markdown.test.ts` | NEW | Unit tests for markdown utilities |

> Lorem ipsum **bold bold bold**, consectetur *italic* elit. Duis ut felis ultricies, *italic* nisi vel, pharetra eros. Aliquam varius pharetra molestie. Duis ut lacus egestas, sodales eros at, suscipit justo. In quis vehicula nibh, et consequat tellus. Suspendisse molestie molestie lorem at hendrerit. Nunc eget elementum ante.

> Sed congue elit vitae neque molestie, non eleifend urna tristique. 
> Suspendisse porttitor pretium neque, vel ultrices dolor imperdiet sed. 
> 
> Sed placerat augue tempor neque bibendum euismod quis sed sem. Nunc mattis, 
> felis nec eleifend pharetra, ipsum nulla maximus massa, sit amet rhoncus ligula felis at est.
>> Nested
> Quote


## Basic Code Blocks

`inline code`
`and ``escaped`` ticks`

    four line code

## Long Lines (Wrapping)

```typescript
const veryLongVariableName = "This is an extremely long string that should definitely wrap when the terminal width is reached, demonstrating that wrapping works correctly";
```


### TypeScript
```typescript
// Comment
interface User {
    id: number;
    name: string;
    email: string;
}

const user: User = {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
};

function greet(user: User): string {
    return `Hello, ${user.name}!`;
}
```

### Python
```python
# Comment
def fibonacci(n):
    """Calculate Fibonacci number recursively."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Example usage
result = fibonacci(10)
print(f"Fibonacci(10) = {result}")
```

### JavaScript
```javascript
// Comment
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(n => n * n);
console.log(squared);
```

### Bash
```bash
#!/bin/bash
# Comment
echo "Running tests..."
bun test --coverage
if [ $? -eq 0 ]; then
    echo "All tests passed!"
else
    echo "Tests failed!"
    exit 1
fi
```

### HTML
```html
<!-- Main navigation component -->
<nav class="navbar" id="main-nav">
    <a href="/home">Home</a>
    <a href="/about">About</a>
    <!-- User menu -->
    <div class="user-menu">
        <span>Welcome, User!</span>
    </div>
</nav>
```

### CSS
```css
/* Main navigation styles */
.navbar {
    display: flex;
    background-color: #333;
    padding: 1rem;
}

/* Tag and class selectors */
.navbar a {
    color: #fff;
    text-decoration: none;
    /* Add spacing between links */
    margin: 0 1rem;
}

/* Pseudo-class selectors */
a:hover {
    opacity: 0.8;
}

a:visited {
    color: #999;
}

/* Pseudo-element selectors */
.button::before {
    content: "→ ";
}

.tooltip::after {
    /* Tooltip arrow */
    content: "";
    border: 5px solid transparent;
}

/* Attribute selectors */
input[type="text"] {
    border: 1px solid #ccc;
}

a[href^="https"]::after {
    content: " 🔗";
}

button[disabled] {
    /* Disabled state */
    opacity: 0.5;
    cursor: not-allowed;
}

/* ID selector */
#main-nav {
    position: sticky;
    top: 0;
}

/* Complex selectors */
div > p:first-child {
    margin-top: 0;
}

ul li:nth-child(odd) {
    background-color: #f5f5f5;
}
```

### GraphQL
```graphql
# Query user data with posts
query GetUser($id: ID!) {
    user(id: $id) {
        id
        name
        email
        # Include recent posts
        posts(limit: 10) {
            title
            content
            createdAt
        }
    }
}
```

### Go
```go
package main

import "fmt"

// User represents a user in the system
type User struct {
    ID    int
    Name  string
    Email string
}

// Greet returns a greeting message
func Greet(user User) string {
    // Format greeting with user's name
    return fmt.Sprintf("Hello, %s!", user.Name)
}
```

### TypeScript with Template Variables
```typescript
// Template string with variable interpolation
const name = "Alice";
const age = 30;
const city = "New York";

// Multi-line template with expressions
const profile = `
    Name: ${name}
    Age: ${age}
    Location: ${city}
    Status: ${age >= 18 ? "Adult" : "Minor"}
`;

console.log(profile);
```

### Diff
```diff
--- a/src/components/User.tsx
+++ b/src/components/User.tsx
@@ -10,7 +10,8 @@
 interface UserProps {
     id: number;
     name: string;
-    role: string;
+    // Changed to enum for type safety
+    role: UserRole;
 }

 export function User({ id, name, role }: UserProps) {
```

## No Language Tag

```
plain code block
no syntax highlighting
should be monospace
```

## Multiple Blocks

First block:
```typescript
const x = 1;
```

Some text between blocks.

Second block:
```python
y = 2
```

## Interactive Features

```typescript
// Test comment on this line
const toDelete = "mark for deletion";
const normalLine = "keep this";
```

## Edge Cases

### Empty Code Block
```
```

### New Lines Only Code Block
```



```

---

## Success Criteria

- [ ] All syntax highlighting renders correctly
- [ ] Fence markers show in dim grey
- [ ] Code background is dark (#1a1a1a)
- [ ] Long lines wrap appropriately
- [ ] Cursor navigation works through code
- [ ] Comments work on code lines
- [ ] Deletion marks work on code lines
- [ ] No performance issues with large plans
- [ ] No regressions in non-code features
