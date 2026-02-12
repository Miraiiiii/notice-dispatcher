import createTabChannel from './tabBus'

export default function createTabCloseSync(
  channelName,
  isOpenOrOnClose,
  maybeOnClose
) {
  const isOpen = typeof maybeOnClose === 'function' ? isOpenOrOnClose : () => true
  const onClose = typeof maybeOnClose === 'function' ? maybeOnClose : isOpenOrOnClose
  const channel = createTabChannel(channelName)
  let isRemoteClose = false
  const unsubscribe = channel.subscribe((msg) => {
    if (!msg || msg.type !== 'close') {
      return
    }
    if (!isOpen()) {
      return
    }
    isRemoteClose = true
    onClose()
  })

  const onLocalClosed = () => {
    if (isRemoteClose) {
      isRemoteClose = false
      return
    }
    channel.post({ type: 'close' })
  }

  const destroy = () => {
    unsubscribe()
    channel.close()
  }

  return { onLocalClosed, destroy }
}
