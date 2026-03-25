export const mockWindow = extra =>
  ({
    location: { pathname: '/', search: '', hash: '' },
    history: { pushState: () => {} },
    ...extra
  })

export const mockDom = () => {
  class Node {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType
      this.nodeName = nodeName
      this.parentNode = null
      this.childNodes = []
    }

    appendChild(child) {
      if (child == null) return child
      this.childNodes.push(child)
      child.parentNode = this
      return child
    }

    insertBefore(next, ref) {
      if (next == null) return next
      if (!ref) return this.appendChild(next)
      const index = this.childNodes.indexOf(ref)
      if (index === -1) throw new Error('insertBefore: reference child not found')
      this.childNodes.splice(index, 0, next)
      next.parentNode = this
      return next
    }

    replaceChild(next, prev) {
      const index = this.childNodes.indexOf(prev)
      if (index === -1)
        throw new Error('replaceChild: previous child not found')
      this.childNodes[index] = next
      next.parentNode = this
      prev.parentNode = null
      return prev
    }

    removeChild(child) {
      const index = this.childNodes.indexOf(child)
      if (index === -1) throw new Error('removeChild: child not found')
      this.childNodes.splice(index, 1)
      child.parentNode = null
      return child
    }
  }

  class TextNode extends Node {
    constructor(text) {
      super(3, '#text')
      this.nodeValue = String(text)
      this.textContent = this.nodeValue
    }
  }

  class CommentNode extends Node {
    constructor(text) {
      super(8, '#comment')
      this.nodeValue = String(text)
      this.textContent = this.nodeValue
    }
  }

  class Style {
    setProperty(key, value) {
      this[String(key)] = String(value)
    }

    removeProperty(key) {
      delete this[String(key)]
    }
  }

  class Element extends Node {
    constructor(tagName, namespaceURI = null) {
      super(1, String(tagName).toUpperCase())
      this.tagName = String(tagName).toUpperCase()
      this.namespaceURI = namespaceURI
      this.attributes = {}
      this.style = new Style()
      this.innerHTML = ''
      this.value = ''
      this.checked = false
      this.selected = false
      this.disabled = false
      this.multiple = false
      this.muted = false
      this.volume = 1
      this.currentTime = 0
      this.playbackRate = 1
      this.open = false
      this.indeterminate = false
    }

    setAttribute(key, value) {
      this.attributes[key] = String(value)
    }

    setAttributeNS(_ns, key, value) {
      this.setAttribute(key, value)
    }

    removeAttribute(key) {
      delete this.attributes[String(key)]
    }
  }

  class Document {
    constructor() {
      this.documentElement = new Element('html')
      this.head = new Element('head')
      this.body = new Element('body')
      this.documentElement.appendChild(this.head)
      this.documentElement.appendChild(this.body)
    }

    createElement(tag) {
      return new Element(tag)
    }

    createElementNS(ns, tag) {
      return new Element(tag, ns)
    }

    createTextNode(text) {
      return new TextNode(text)
    }

    createComment(text) {
      return new CommentNode(text)
    }

    replaceChild(next, prev) {
      return this.documentElement.replaceChild(next, prev)
    }
  }

  return { document: new Document() }
}
