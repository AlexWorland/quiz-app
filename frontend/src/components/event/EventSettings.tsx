import { useState } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { updateEvent } from '../../api/endpoints'
import type { Event } from '../../api/endpoints'

interface EventSettingsProps {
  event: Event
  onUpdate: (event: Event) => void
}

export function EventSettings({ event, onUpdate }: EventSettingsProps) {
  const [showModal, setShowModal] = useState(false)
  const [settings, setSettings] = useState({
    time_per_question: event.time_per_question,
    questions_to_generate: event.questions_to_generate,
    num_fake_answers: event.num_fake_answers,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await updateEvent(event.id, settings)
      onUpdate(response.data)
      setShowModal(false)
    } catch (error) {
      console.error('Failed to update settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2"
      >
        <Settings className="w-4 h-4" />
        Event Settings
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Event Settings</h2>
            
            <div className="space-y-4">
              <div>
                <Input
                  label="Time Per Question (seconds)"
                  type="number"
                  min={5}
                  max={300}
                  value={settings.time_per_question}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    time_per_question: parseInt(e.target.value) || 30 
                  })}
                />
              </div>

              <div>
                <Input
                  label="Questions to Generate"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.questions_to_generate}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    questions_to_generate: parseInt(e.target.value) || 5 
                  })}
                />
                <p className="text-xs text-gray-400 mt-1">
                  How many questions AI should generate from each presentation
                </p>
              </div>

              <div>
                <Input
                  label="Number of Fake Answers"
                  type="number"
                  min={1}
                  max={5}
                  value={settings.num_fake_answers}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    num_fake_answers: parseInt(e.target.value) || 3 
                  })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

