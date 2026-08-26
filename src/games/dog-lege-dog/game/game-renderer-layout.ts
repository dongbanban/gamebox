export function fitDogBoardToFrame(root: HTMLElement): void {
  const frame = root.querySelector<HTMLElement>(".dog-board-frame");
  const scaler = root.querySelector<HTMLElement>(".dog-board-scaler");
  const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
  if (frame === null || scaler === null || board === null) {
    return;
  }

  const frameStyle = getComputedStyle(frame);
  const availableWidth = frame.clientWidth -
    Number.parseFloat(frameStyle.paddingLeft) -
    Number.parseFloat(frameStyle.paddingRight);
  const availableHeight = frame.clientHeight -
    Number.parseFloat(frameStyle.paddingTop) -
    Number.parseFloat(frameStyle.paddingBottom);
  const boardOuterWidth = board.offsetWidth;
  const boardOuterHeight = board.offsetHeight;
  if (boardOuterWidth <= 0 || boardOuterHeight <= 0) {
    return;
  }

  const widthScale = availableWidth > 0 ? availableWidth / boardOuterWidth : 1;
  const heightScale = availableHeight > 0 ? availableHeight / boardOuterHeight : 1;
  const scale = Math.min(1, widthScale, heightScale);
  board.style.setProperty("--board-display-scale", String(scale));
  scaler.style.width = `${boardOuterWidth * scale}px`;
  scaler.style.height = `${boardOuterHeight * scale}px`;
}
