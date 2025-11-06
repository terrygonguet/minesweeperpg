import { create_world, draw_world, handle_input, update_world } from "./game"
import "./style.css"

const canvas = document.querySelector<HTMLCanvasElement>("#game")!
const rect = canvas.getBoundingClientRect()
canvas.width = (rect.width / 2) * devicePixelRatio
canvas.height = (rect.height / 2) * devicePixelRatio
const offscreen = new OffscreenCanvas(canvas.width, canvas.height)

const ctx_real = canvas.getContext("bitmaprenderer", { alpha: false })
const ctx_off = offscreen.getContext("2d", { alpha: false })
if (ctx_real && ctx_off) {
	document.addEventListener("keydown", evt => {
		switch (evt.code) {
			case "KeyW":
				handle_input(world, { type: "keydown", key: "up" })
				break
			case "KeyS":
				handle_input(world, { type: "keydown", key: "down" })
				break
			case "KeyA":
				handle_input(world, { type: "keydown", key: "left" })
				break
			case "KeyD":
				handle_input(world, { type: "keydown", key: "right" })
				break
			case "KeyQ":
				handle_input(world, { type: "keydown", key: "attack" })
				break
			case "KeyE":
				handle_input(world, { type: "keydown", key: "loot" })
				break
		}
	})
	document.addEventListener("keyup", evt => {
		switch (evt.code) {
			case "KeyW":
				handle_input(world, { type: "keyup", key: "up" })
				break
			case "KeyS":
				handle_input(world, { type: "keyup", key: "down" })
				break
			case "KeyA":
				handle_input(world, { type: "keyup", key: "left" })
				break
			case "KeyD":
				handle_input(world, { type: "keyup", key: "right" })
				break
			case "KeyQ":
				handle_input(world, { type: "keyup", key: "attack" })
				break
			case "KeyE":
				handle_input(world, { type: "keyup", key: "loot" })
				break
		}
	})

	const world = create_world()
	let previous = performance.now()
	const raf = (time: number) => {
		const delta = time - previous
		previous = time
		update_world(world, delta / 1000)

		draw_world(world, ctx_off)
		const bitmap = offscreen.transferToImageBitmap()
		ctx_real.transferFromImageBitmap(bitmap)

		requestAnimationFrame(raf)
	}
	requestAnimationFrame(raf)
}
