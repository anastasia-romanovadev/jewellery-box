import { Button, Group, Modal, Text } from '@mantine/core'

export function DiscardJewelryDialog({
  opened,
  onStay,
  onDiscard,
}: {
  opened: boolean
  onStay: () => void
  onDiscard: () => void
}) {
  return (
    <Modal
      stackId="discard-jewelry"
      opened={opened}
      onClose={onStay}
      centered
      size="sm"
      title="Выйти без сохранения?"
      aria-describedby="discard-jewelry-message"
      closeButtonProps={{ 'aria-label': 'Остаться в форме' }}
      closeOnClickOutside={false}
    >
      <Text id="discard-jewelry-message">Ты забыла нажать «Сохранить», точно выйти?</Text>
      <Group mt="lg" justify="flex-end">
        <Button type="button" variant="default" onClick={onStay} data-autofocus>
          Остаться
        </Button>
        <Button type="button" color="var(--accent)" onClick={onDiscard}>
          Выйти без сохранения
        </Button>
      </Group>
    </Modal>
  )
}
