let count = 1;

document.getElementById("add")!.addEventListener("click", () => {
  const item = document.createElement("li");

  item.dataset.key = `item-${++count}`;
  item.textContent = `Task number ${count}`;
  document.getElementById("list")!.append(item);
});
