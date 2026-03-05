// Funzione di utilità per convertire una stringa base64 in un Blob
export const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
  try {
    const response = await fetch(`data:${mimeType};base64,${base64}`);
    return await response.blob();
  } catch (e) {
    console.error("Error converting base64 to blob using fetch, falling back to atob", e);
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
};


export const stripFormatting = (text: string): string => {
    if (!text) return '';

    const latexToPlainText = (formula: string): string => {
        // Heuristic: if it contains environments like matrix, align, etc., it's too complex.
        if (/\\begin\{([a-zA-Z*]+)\}/.test(formula)) {
            return '[Formula]';
        }

        // Extensive list of symbols for conversion
        const symbols: Record<string, string> = {
            // Greek letters
            '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε', '\\zeta': 'ζ',
            '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
            '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ',
            '\\upsilon': 'υ', '\\phi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
            '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ', '\\Pi': 'Π',
            '\\Sigma': 'Σ', '\\Upsilon': 'Υ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
            // Operators and relations
            '\\cdot': '·', '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
            '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈', '\\equiv': '≡',
            // Calculus and sums
            '\\int': '∫', '\\sum': '∑', '\\prod': '∏', '\\partial': '∂', '\\nabla': '∇',
            '\\infty': '∞',
            // Logic and sets
            '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
            '\\supset': '⊃', '\\supseteq': '⊇', '\\cap': '∩', '\\cup': '∪', '\\emptyset': '∅',
            '\\land': '∧', '\\lor': '∨', '\\neg': '¬', '\\therefore': '∴',
            // Arrows
            '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
            '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔', '\\mapsto': '↦', '\\uparrow': '↑', '\\downarrow': '↓',
            '\\implies': '⇒',
            // Other
            '\\ldots': '...', '\\cdots': '⋯',
            '\\perp': '⊥',
            '\\parallel': '∥',
            '\\circ': '°',
            '\\hbar': 'ħ', '\\ell': 'ℓ',
        };
        
        const sup: Record<string, string> = {'1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','0':'⁰','+':'⁺','-':'⁻','a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','i':'ⁱ','n':'ⁿ','x':'ˣ','y':'ʸ','z':'ᶻ'};
        const sub: Record<string, string> = {'1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','0':'₀','+':'₊','-':'₋','a':'ₐ','e':'ₑ','h':'ₕ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','p':'ₚ','s':'ₛ','t':'ₜ','x':'ₓ'};

        let plain = formula.trim();

        // Specific high-priority replacements before generic ones
        plain = plain.replace(/\\vec\{([a-zA-Z])\}/g, '$1\u20D7'); // Handle \vec{F} -> F⃗
        plain = plain.replace(/\^\\circ/g, '°'); // Handle degree symbol `^\circ` -> `°`
        // Strip limits from integrals, sums, products.
        plain = plain.replace(/\\(int|sum|prod)(?:_\{[^{}]*\}|\^\{[^{}]*\}|_[^\{\s]|\^[^{\s])+/g, '\\$1 ');

        // Replace all known symbols
        for (const key in symbols) {
            plain = plain.replace(new RegExp(key.replace(/\\/g, '\\\\'), 'g'), symbols[key]);
        }
        
        // Handle fractions with a loop to catch simple nested ones
        const fracRegex = /\\frac\{([^\{\}]+)\}\{([^\{\}]+)\}/g;
        for (let i = 0; i < 5 && fracRegex.test(plain); i++) { // Limit iterations to prevent infinite loops
          plain = plain.replace(fracRegex, '($1/$2)');
        }

        // Handle square roots (including nth root)
        plain = plain.replace(/\\sqrt\[([^\[\]]+)\]\{([^\{\}]+)\}/g, '($1)√($2)');
        plain = plain.replace(/\\sqrt\{([^\{\}]+)\}/g, '√($1)');
        
        // Handle superscripts and subscripts
        plain = plain.replace(/\^\{([^\{\}]+)\}/g, (_, p1) => p1.split('').map(c => sup[c] || c).join(''));
        plain = plain.replace(/\^([^\s{}^_])/g, (_, p1) => sup[p1] || `^${p1}`);
        plain = plain.replace(/_\{([^\{\}]+)\}/g, (_, p1) => p1.split('').map(c => sub[c] || c).join(''));
        plain = plain.replace(/_([^\s{}^_])/g, (_, p1) => sub[p1] || `_${p1}`);
        
        // Replace common functions with their text equivalent
        plain = plain.replace(/\\(sin|cos|tan|log|ln|det|dim|lim|min|max|exp)\b/g, '$1 ');

        // Clean up remaining LaTeX artifacts
        plain = plain.replace(/\{|\}/g, ''); // Braces
        plain = plain.replace(/\\,\s*|\\;|\\\s/g, ' '); // Spacing commands
        plain = plain.replace(/\\(mathrm|text)\s*\{([^\{\}]+)\}/g, '$2'); // Text in math mode

        // Final check: if any backslashes remain, it's an unhandled command.
        if (plain.includes('\\')) {
            // Allow remaining single character vectors that are already unicode
            const cleanedPlain = plain.replace(/[⃗]/g, '');
            if (cleanedPlain.includes('\\')) {
              return '[Formula]';
            }
        }

        return plain;
    };

    let strippedText = text;
    // Process math environments first
    strippedText = strippedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => `\n${latexToPlainText(formula)}\n`);
    strippedText = strippedText.replace(/\$(.*?)\$/g, (match, formula) => latexToPlainText(formula));

    // Process Markdown
    strippedText = strippedText.replace(/^(#+)\s/gm, ''); // Headings
    strippedText = strippedText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    strippedText = strippedText.replace(/\*(.*?)\*/g, '$1'); // Italic
    strippedText = strippedText.replace(/^\s*\*\s/gm, '• '); // List items
    strippedText = strippedText.replace(/^\s*---\s*$/gm, '--------------------'); // Horizontal rule
    strippedText = strippedText.replace(/\n{3,}/g, '\n\n'); // Normalize newlines
    
    return strippedText.trim();
};