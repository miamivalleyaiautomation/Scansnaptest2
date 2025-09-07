<template>
  <div class="container">
    <div class="controls">
      <p>
        Select camera by constraint or device ID:
        <select v-model="selectedConstraints">
          <option
            v-for="option in constraintOptions"
            :key="option.label"
            :value="option.constraints"
          >
            {{ option.label }}
          </option>
        </select>
      </p>

      <p>
        Realtime highlights:
        <select v-model="trackFunctionSelected">
          <option
            v-for="option in trackFunctionOptions"
            :key="option.text"
            :value="option"
          >
            {{ option.text }}
          </option>
        </select>
      </p>

      <p>
        Barcode formats (more = slower):<br />
        <span
          v-for="option in Object.keys(barcodeFormats)"
          :key="option"
          class="barcode-format-checkbox"
        >
          <input type="checkbox" v-model="barcodeFormats[option]" :id="option" />
          <label :for="option">{{ option }}</label>
        </span>
      </p>

      <p class="error">{{ error }}</p>
      <p class="decode-result">
        Last result: <b>{{ result }}</b>
      </p>
    </div>

    <div class="qr-wrapper">
      <QrcodeStream
        :constraints="selectedConstraints"
        :track="trackFunctionSelected.value"
        :formats="selectedBarcodeFormats"
        @error="onError"
        @detect="onDetect"
        @camera-on="onCameraReady"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { QrcodeStream } from 'vue-qrcode-reader'

/*** detection handling ***/
const result = ref('')

function onDetect(detectedCodes: any[]) {
  // why: keep UI responsive during rapid scans
  result.value = JSON.stringify(detectedCodes.map((c: any) => c.rawValue))
}

/*** select camera ***/
const selectedConstraints = ref<MediaTrackConstraints>({ facingMode: 'environment' })
type ConstraintOption = { label: string; constraints: MediaTrackConstraints }

const defaultConstraintOptions: ConstraintOption[] = [
  { label: 'rear camera', constraints: { facingMode: 'environment' } },
  { label: 'front camera', constraints: { facingMode: 'user' } }
]
const constraintOptions = ref<ConstraintOption[]>(defaultConstraintOptions)

async function onCameraReady() {
  // why: iOS blocks enumerateDevices before permission; this fires after permission
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(({ kind }) => kind === 'videoinput')

    constraintOptions.value = [
      ...defaultConstraintOptions,
      ...videoDevices.map(({ deviceId, label }) => ({
        label: `${label || 'camera'} (ID: ${deviceId})`,
        constraints: { deviceId }
      }))
    ]
    error.value = ''
  } catch (e: any) {
    error.value = `[EnumerateError]: ${e?.message || 'failed to enumerate devices'}`
  }
}

/*** track functions ***/
function paintOutline(detectedCodes: any[], ctx: CanvasRenderingContext2D) {
  for (const code of detectedCodes) {
    const [firstPoint, ...otherPoints] = code.cornerPoints
    ctx.strokeStyle = 'red'
    ctx.beginPath()
    ctx.moveTo(firstPoint.x, firstPoint.y)
    for (const { x, y } of otherPoints) ctx.lineTo(x, y)
    ctx.lineTo(firstPoint.x, firstPoint.y)
    ctx.closePath()
    ctx.stroke()
  }
}
function paintBoundingBox(detectedCodes: any[], ctx: CanvasRenderingContext2D) {
  for (const code of detectedCodes) {
    const { x, y, width, height } = code.boundingBox
    ctx.lineWidth = 2
    ctx.strokeStyle = '#007bff'
    ctx.strokeRect(x, y, width, height)
  }
}
function paintCenterText(detectedCodes: any[], ctx: CanvasRenderingContext2D) {
  for (const code of detectedCodes) {
    const { boundingBox, rawValue } = code
    const centerX = boundingBox.x + boundingBox.width / 2
    const centerY = boundingBox.y + boundingBox.height / 2
    const fontSize = Math.max(12, (50 * boundingBox.width) / ctx.canvas.width)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#35495e'
    ctx.strokeText(rawValue, centerX, centerY)
    ctx.fillStyle = '#5cb984'
    ctx.fillText(rawValue, centerX, centerY)
  }
}
const trackFunctionOptions = [
  { text: 'nothing (default)', value: undefined },
  { text: 'outline', value: paintOutline },
  { text: 'centered text', value: paintCenterText },
  { text: 'bounding box', value: paintBoundingBox }
]
const trackFunctionSelected = ref(trackFunctionOptions[1])

/*** barcode formats ***/
const barcodeFormats = ref<Record<string, boolean>>({
  aztec: false,
  code_128: false,
  code_39: false,
  code_93: false,
  codabar: false,
  databar: false,
  databar_expanded: false,
  data_matrix: false,
  dx_film_edge: false,
  ean_13: false,
  ean_8: false,
  itf: false,
  maxi_code: false,
  micro_qr_code: false,
  pdf417: false,
  qr_code: true,
  rm_qr_code: false,
  upc_a: false,
  upc_e: false,
  linear_codes: false,
  matrix_codes: false
})
const selectedBarcodeFormats = computed<string[]>(() =>
  Object.keys(barcodeFormats.value).filter((f) => barcodeFormats.value[f])
)

/*** error handling ***/
const error = ref('')

function onError(err: Error & { name: string }) {
  // why: actionable, user-friendly error messages
  error.value = `[${err.name}]: `
  if (err.name === 'NotAllowedError') {
    error.value += 'you need to grant camera access permission'
  } else if (err.name === 'NotFoundError') {
    error.value += 'no camera on this device'
  } else if (err.name === 'NotSupportedError') {
    error.value += 'secure context required (HTTPS, localhost)'
  } else if (err.name === 'NotReadableError') {
    error.value += 'is the camera already in use?'
  } else if (err.name === 'OverconstrainedError') {
    error.value += 'installed cameras are not suitable'
  } else if (err.name === 'StreamApiNotSupportedError') {
    error.value += 'Stream API is not supported in this browser'
  } else if (err.name === 'InsecureContextError') {
    error.value += 'Camera access is only permitted in secure context. Use HTTPS or localhost rather than HTTP.'
  } else {
    error.value += err.message
  }
}
</script>
