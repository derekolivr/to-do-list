interface Task {
  text: string;
  priority: "high" | "medium" | "low";
  dueDate: string | null;
}

interface FinishedTask {
  task: Task;
  originalList: string;
}

interface State {
  lists: {
    [key: string]: Task[];
  };
  finished: FinishedTask[];
  activeList: string;
  backgroundImageIndex: number;
  customBackgrounds: Background[];
  currentTheme: string;
  themeLocked: boolean;
}

interface Background {
  url: string;
  theme?: string;
}

const todoInput = document.getElementById("todo-input") as HTMLInputElement;
const addButton = document.getElementById("add-button") as HTMLButtonElement;
const todoList = document.getElementById("todo-list") as HTMLUListElement;
const changeBgButton = document.getElementById(
  "change-bg-button"
) as HTMLButtonElement;
const container = document.querySelector(".container") as HTMLDivElement;
const changeThemeButton = document.getElementById(
  "change-theme-button"
) as HTMLButtonElement;
const tabsContainer = document.getElementById(
  "tabs-container"
) as HTMLDivElement;
const addListButton = document.getElementById(
  "add-list-button"
) as HTMLButtonElement;
const listTitle = document.getElementById("list-title") as HTMLHeadingElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const prioritySelect = document.getElementById(
  "priority-select"
) as HTMLSelectElement;
const dueDateInput = document.getElementById(
  "due-date-input"
) as HTMLInputElement;
const backgroundCarousel = document.getElementById(
  "background-carousel"
) as HTMLDivElement;
const carouselGrid = document.getElementById("carousel-grid") as HTMLDivElement;

let defaultBackgrounds: Background[] = [
  {
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2072&auto=format&fit=crop",
    theme: "theme-sepia",
  },
  {
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop",
    theme: "theme-white",
  },
  {
    url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2070&auto=format&fit=crop",
    theme: "theme-skyblue",
  },
  {
    url: "https://images.unsplash.com/photo-1443926818681-717d074a57af?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
  },
];

let state: State = {
  lists: {
    "To-Do": [],
  },
  finished: [],
  activeList: "To-Do",
  backgroundImageIndex: 0,
  customBackgrounds: [],
  currentTheme: "theme-white",
  themeLocked: false,
};

let searchQuery = "";

// Migrate old string-based tasks to object format
const migrateTasks = (tasks: (Task | string)[]): Task[] => {
  return tasks.map((task) => {
    if (typeof task === "string") {
      return { text: task, priority: "medium", dueDate: null };
    }
    return task;
  });
};

const migrateFinishedTasks = (tasks: any[]): FinishedTask[] => {
  return tasks.map((item) => {
    if (typeof item === "string") {
      return {
        task: { text: item, priority: "medium", dueDate: null },
        originalList: "Archived",
      };
    }
    if (item.text && !item.task) {
      return { task: item, originalList: "Archived" };
    }
    return item;
  });
};

const migrateState = (oldState: any): State => {
  const newState: State = { ...oldState };
  if (!newState.lists) {
    newState.lists = { "To-Do": [] };
  }
  if (!newState.finished) {
    newState.finished = [];
  }
  if (!newState.customBackgrounds) {
    newState.customBackgrounds = [];
  }
  if (!newState.currentTheme) {
    newState.currentTheme = "theme-white";
  }
  if (newState.themeLocked === undefined) {
    newState.themeLocked = false;
  }
  Object.keys(newState.lists).forEach((listName) => {
    newState.lists[listName] = migrateTasks(newState.lists[listName] || []);
  });
  newState.finished = migrateFinishedTasks(newState.finished || []);
  return newState;
};

const getResizedImageUrl = (url: string): string => {
  if (url.includes("&w=") || url.includes("?w=")) {
    return url; // Assume it's already resized
  }
  const urlParts = url.split("?");
  const newParams = "w=1920&h=1080&fit=crop&q=80";
  if (urlParts.length > 1) {
    return `${urlParts[0]}?${urlParts[1]}&${newParams}`;
  }
  return `${urlParts[0]}?${newParams}`;
};

const getThemeForImage = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve("theme-white");
        return;
      }
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;
      let brightness = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        brightness += r * 0.299 + g * 0.587 + b * 0.114;
      }

      brightness /= img.width * img.height;

      // Automatic theme selection based on brightness
      if (brightness < 85) {
        resolve("theme-white"); // Very dark images
      } else if (brightness > 170) {
        resolve("theme-black"); // Very light images
      } else if (brightness < 128) {
        resolve("theme-sepia"); // Mid-dark images
      } else {
        resolve("theme-skyblue"); // Mid-light images
      }
    };
    img.onerror = () => {
      resolve("theme-white"); // Default on error
    };
  });
};

const getBackgrounds = (): Background[] => {
  return [...defaultBackgrounds, ...state.customBackgrounds];
};
let currentImageIndex = 0;
const themes = [
  "theme-white",
  "theme-black",
  "theme-skyblue",
  "theme-sepia",
];
let currentThemeIndex = 0;

const saveState = () => {
  try {
    chrome.storage.sync.set({ appState: state }, () => {
      if (chrome.runtime?.lastError) {
        console.error(
          "Error saving state to chrome.storage:",
          chrome.runtime.lastError
        );
      }
    });
  } catch (e) {
    localStorage.setItem("appState", JSON.stringify(state));
  }
};

const applyTheme = (theme: string) => {
  container.classList.remove(
    "theme-white",
    "theme-black",
    "theme-skyblue",
    "theme-sepia"
  );
  container.classList.add(theme);
};

const formatDate = (
  dateString: string | null
): { text: string; class: string } | null => {
  if (!dateString) return null;

  // Parse the date string as local date (YYYY-MM-DD format from input)
  const [year, month, day] = dateString.split("-").map(Number);
  const taskDate = new Date(year!, month! - 1, day!);
  taskDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const formattedDate = taskDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { text: `Overdue (${formattedDate})`, class: "overdue" };
  } else if (diffDays === 0) {
    return { text: "Today", class: "today" };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", class: "" };
  } else {
    const formattedDate = taskDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { text: formattedDate, class: "" };
  }
};

const render = () => {
  // Render tabs
  tabsContainer.innerHTML = "";
  Object.keys(state.lists).forEach((listName) => {
    const tab = document.createElement("div");
    tab.className = "tab";
    if (listName === state.activeList) {
      tab.classList.add("active");
    }

    const tabText = document.createElement("span");
    tabText.textContent = listName;
    tabText.className = "tab-text";

    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.className = "tab-close";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent tab click when clicking close
      if (
        confirm(
          `Are you sure you want to delete "${listName}"? This will remove all tasks in this list.`
        )
      ) {
        delete state.lists[listName];
        // If we deleted the active list, switch to another list or "To-Do"
        if (state.activeList === listName) {
          const remainingLists = Object.keys(state.lists);
          state.activeList =
            remainingLists.length > 0 ? remainingLists[0]! : "To-Do";
          // If no lists remain, create default "To-Do" list
          if (remainingLists.length === 0) {
            state.lists["To-Do"] = [];
            state.activeList = "To-Do";
          }
        }
        saveState();
        render();
      }
    });

    tab.appendChild(tabText);
    tab.appendChild(closeButton);

    tab.addEventListener("click", () => {
      state.activeList = listName;
      render();
    });
    tabsContainer.appendChild(tab);
  });

  // Add Finished tab
  const finishedTab = document.createElement("div");
  finishedTab.textContent = "Finished";
  finishedTab.className = "tab";
  if (state.activeList === "Finished") {
    finishedTab.classList.add("active");
  }
  finishedTab.addEventListener("click", () => {
    state.activeList = "Finished";
    render();
  });
  tabsContainer.appendChild(finishedTab);

  // Render title
  listTitle.textContent = state.activeList;

  // Render todos or finished list
  todoList.innerHTML = "";

  const isFinishedTab = state.activeList === "Finished";

  // Toggle input visibility
  const inputs = [
    addButton,
    todoInput,
    prioritySelect,
    dueDateInput,
    searchInput,
  ];
  inputs.forEach(
    (input) => (input.style.display = isFinishedTab ? "none" : "")
  );

  if (isFinishedTab) {
    state.finished.forEach((finishedItem, index) => {
      const li = document.createElement("li");
      li.className = "finished-item";

      const contentSpan = document.createElement("span");
      contentSpan.textContent = finishedItem.task.text;

      const listBadge = document.createElement("span");
      listBadge.className = "original-list-badge";
      listBadge.textContent = `from: ${finishedItem.originalList}`;

      const restoreButton = document.createElement("button");
      restoreButton.className = "restore-btn";
      restoreButton.innerHTML = "&#8634;"; // Undo arrow
      restoreButton.title = "Restore task";
      restoreButton.addEventListener("click", () => {
        restoreTodo(index);
      });

      li.appendChild(contentSpan);
      li.appendChild(listBadge);
      li.appendChild(restoreButton);
      if (todoList) {
        todoList.appendChild(li);
      }
    });
  } else {
    let activeTodos = state.lists[state.activeList] || [];

    // Filter by search query
    if (searchQuery.trim()) {
      activeTodos = activeTodos.filter((task) =>
        task.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    activeTodos.forEach((task, index) => {
      const originalIndex = (
        state.lists[state.activeList] || []
      ).indexOf(task);

      const li = document.createElement("li");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => {
        completeTodo(originalIndex);
      });

      const taskContent = document.createElement("div");
      taskContent.className = "task-content";

      const priorityBadge = document.createElement("span");
      priorityBadge.className = `priority-badge priority-${task.priority}`;
      priorityBadge.textContent = task.priority;

      const taskText = document.createElement("span");
      taskText.className = "task-text";
      taskText.textContent = task.text;
      taskText.addEventListener("dblclick", () => {
        editTask(originalIndex, li);
      });

      taskContent.appendChild(priorityBadge);
      taskContent.appendChild(taskText);

      if (task.dueDate) {
        const dateInfo = formatDate(task.dueDate);
        if (dateInfo) {
          const dueDateSpan = document.createElement("span");
          dueDateSpan.className = `due-date ${dateInfo.class}`;
          dueDateSpan.textContent = dateInfo.text;
          taskContent.appendChild(dueDateSpan);
        }
      }

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "×";
      deleteButton.classList.add("delete-btn");
      deleteButton.addEventListener("click", () => {
        removeTodo(originalIndex);
      });

      li.appendChild(checkbox);
      li.appendChild(taskContent);
      li.appendChild(deleteButton);
      if (todoList) {
        todoList.appendChild(li);
      }
    });
  }
};

const editTask = (index: number, liElement: HTMLLIElement) => {
  const task = state.lists[state.activeList]?.[index];
  if (!task) return;

  liElement.classList.add("editing");
  const originalContent = liElement.innerHTML;

  liElement.innerHTML = `
      <div class="task-edit-container">
          <input type="text" class="task-edit-input" value="${task.text}">
          <select class="task-edit-priority">
              <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
              <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
              <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
          </select>
          <input type="date" class="task-edit-due-date" value="${task.dueDate || ""}">
          <button class="task-edit-save">Save</button>
          <button class="task-edit-cancel">Cancel</button>
      </div>
  `;

  const saveButton = liElement.querySelector(
    ".task-edit-save"
  ) as HTMLButtonElement;
  const cancelButton = liElement.querySelector(
    ".task-edit-cancel"
  ) as HTMLButtonElement;
  const textInput = liElement.querySelector(
    ".task-edit-input"
  ) as HTMLInputElement;
  const priorityInput = liElement.querySelector(
    ".task-edit-priority"
  ) as HTMLSelectElement;
  const dueDateInput = liElement.querySelector(
    ".task-edit-due-date"
  ) as HTMLInputElement;

  const saveEdit = () => {
    const newText = textInput.value.trim();
    if (newText) {
      const updatedTask: Task = {
        ...task,
        text: newText,
        priority: priorityInput.value as "high" | "medium" | "low",
        dueDate: dueDateInput.value || null,
      };
      state.lists[state.activeList]![index] = updatedTask;
      saveState();
      render();
    } else {
      // If text is empty, revert and re-render to restore event listeners
      liElement.classList.remove("editing");
      render();
    }
  };

  saveButton.addEventListener("click", saveEdit);

  cancelButton.addEventListener("click", () => {
    liElement.innerHTML = originalContent;
    liElement.classList.remove("editing");
    // We need to re-attach the event listener after reverting innerHTML
    render();
  });

  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") saveEdit();
  });
};

const completeTodo = (index: number) => {
  const task = state.lists[state.activeList]?.[index];
  if (!task) return;
  state.finished.unshift({ task: task, originalList: state.activeList });
  state.lists[state.activeList]?.splice(index, 1);
  saveState();
  render();
};

const restoreTodo = (index: number) => {
  const finishedItem = state.finished[index];
  if (!finishedItem) return;
  const { task, originalList } = finishedItem;

  if (!state.lists[originalList]) {
    state.lists[originalList] = [];
  }

  state.lists[originalList].push(task);
  state.finished.splice(index, 1);

  saveState();
  render();
};

const loadState = () => {
  try {
    chrome.storage.sync.get(["appState"], (result) => {
      if (chrome.runtime?.lastError) {
        console.error(
          "Error loading state from chrome.storage:",
          chrome.runtime.lastError
        );
        // Fallback to local storage if sync is unavailable
        chrome.storage.local.get(["appState"], (localResult) => {
          if (localResult.appState) {
            state = migrateState(localResult.appState);
          }
          initialize();
        });
        return;
      }

      if (result.appState) {
        state = migrateState(result.appState);
      }
      initialize();
    });
  } catch (e) {
    const savedState = localStorage.getItem("appState");
    if (savedState) {
      state = migrateState(JSON.parse(savedState));
    }
    initialize();
  }
};

const initialize = () => {
  // Set background and theme from loaded state
  const backgrounds = getBackgrounds();
  currentImageIndex = state.backgroundImageIndex || 0;
  if (currentImageIndex >= backgrounds.length) {
    currentImageIndex = 0;
    state.backgroundImageIndex = 0;
  }
  const background = backgrounds[currentImageIndex];
  if (background) {
    document.body.style.backgroundImage = `url('${getResizedImageUrl(
      background.url
    )}')`;
  }
  // Apply saved theme (or use background theme if not locked)
  if (state.currentTheme) {
    applyTheme(state.currentTheme);
    currentThemeIndex = themes.indexOf(state.currentTheme);
  } else if (background?.theme) {
    applyTheme(background.theme);
    currentThemeIndex = themes.indexOf(background.theme);
  }
  // Update theme lock button state after DOM is ready
  setTimeout(() => updateThemeLockButton(), 0);
  render();
};

loadState();

const saveBackgroundImage = () => {
  state.backgroundImageIndex = currentImageIndex;
  saveState();
};

const addTodo = () => {
  const todoText = todoInput.value.trim();
  if (todoText !== "" && state.activeList !== "Finished") {
    if (!state.lists[state.activeList]) {
      state.lists[state.activeList] = [];
    }
    const priority = prioritySelect.value as "high" | "medium" | "low";
    const dueDate = dueDateInput.value || null;
    state.lists[state.activeList]?.push({
      text: todoText,
      priority,
      dueDate,
    });
    todoInput.value = "";
    dueDateInput.value = "";
    prioritySelect.value = "medium";
    saveState();
    render();
  }
};

const removeTodo = (index: number) => {
  if (state.activeList !== "Finished") {
    state.lists[state.activeList]?.splice(index, 1);
    saveState();
    render();
  }
};

addListButton.addEventListener("click", () => {
  const newListName = prompt("Enter the name for the new list:");
  if (newListName && !state.lists[newListName]) {
    state.lists[newListName] = [];
    state.activeList = newListName;
    saveState();
    render();
  } else if (newListName) {
    alert("A list with this name already exists.");
  }
});

searchInput.addEventListener("input", (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  render();
});

addButton.addEventListener("click", addTodo);
todoInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addTodo();
  }
});

changeBgButton.addEventListener("click", () => {
  populateCarousel();
  backgroundCarousel.classList.remove("hidden");
});

backgroundCarousel.addEventListener("click", (e) => {
  // Close if clicking on the background overlay
  if (e.target === backgroundCarousel) {
    backgroundCarousel.classList.add("hidden");
  }
});

const populateCarousel = () => {
  carouselGrid.innerHTML = "";
  const backgrounds = getBackgrounds();
  const defaultCount = defaultBackgrounds.length;

  backgrounds.forEach((bg, index) => {
    const item = document.createElement("div");
    item.className = "carousel-item";
    const isCustom = index >= defaultCount;

    const thumb = document.createElement("img");
    thumb.className = "carousel-thumbnail";
    thumb.src = getResizedImageUrl(bg.url).replace(
      "w=1920&h=1080",
      "w=300&h=200"
    );
    thumb.addEventListener("click", async () => {
      currentImageIndex = index;
      const newBackground = backgrounds[currentImageIndex];

      if (newBackground) {
        document.body.style.backgroundImage = `url('${getResizedImageUrl(
          newBackground.url
        )}')`;
        // Only auto-detect theme if not locked
        if (!state.themeLocked) {
          const theme = await getThemeForImage(thumb.src);
          applyTheme(theme as string);
          currentThemeIndex = themes.indexOf(theme as string);
          state.currentTheme = theme as string;
        }
      }
      state.backgroundImageIndex = currentImageIndex;
      saveState();
      backgroundCarousel.classList.add("hidden");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "carousel-delete-btn";
    deleteBtn.innerHTML = "&times;";
    // Only allow deleting custom backgrounds
    if (isCustom) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteBackground(index);
      });
    } else {
      deleteBtn.style.display = "none";
    }

    item.appendChild(thumb);
    item.appendChild(deleteBtn);
    carouselGrid.appendChild(item);
  });

  // Add the "Add Image" card
  const addCard = document.createElement("div");
  addCard.className = "add-image-card";
  addCard.innerHTML = "<span>+</span>";
  addCard.addEventListener("click", addNewBackground);
  carouselGrid.appendChild(addCard);

  // Add the "Plain Color" card
  const colorCard = document.createElement("div");
  colorCard.className = "color-picker-card";
  colorCard.innerHTML = "<span>Custom Solid<br>Colors</span>";
  colorCard.addEventListener("click", showColorPalette);
  carouselGrid.appendChild(colorCard);
};

const addNewBackground = () => {
  const url = prompt("Please enter the Unsplash image URL:");
  if (url && url.startsWith("https://images.unsplash.com/")) {
    const resizedUrl = getResizedImageUrl(url);
    getThemeForImage(
      resizedUrl.replace("w=1920&h=1080", "w=300&h=200")
    ).then((theme) => {
      state.customBackgrounds.push({ url: resizedUrl, theme: theme as string });
      saveState();
      populateCarousel();
    });
  } else if (url) {
    alert("Invalid URL. Please use a valid Unsplash image URL.");
  }
};

const showColorPalette = () => {
  const palette = document.createElement("div");
  palette.className = "color-palette";
  palette.style.display = "flex";

  const colors = ["#f4f4f9", "#2c3e50", "#8e44ad", "#2980b9", "#16a085", "#d35400"];
  colors.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.addEventListener("click", () => {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = color;
      // Only auto-detect theme if not locked
      if (!state.themeLocked) {
        const isDark =
          parseInt(color.slice(1, 3), 16) * 0.299 +
          parseInt(color.slice(3, 5), 16) * 0.587 +
          parseInt(color.slice(5, 7), 16) * 0.114 <
          186;
        const theme = isDark ? "theme-white" : "theme-black";
        applyTheme(theme);
        state.currentTheme = theme;
        saveState();
      }
      backgroundCarousel.classList.add("hidden");
      palette.remove();
    });
    palette.appendChild(swatch);
  });

  backgroundCarousel.appendChild(palette);

  // Close palette when clicking outside
  setTimeout(() => {
    const clickOutside = (e: MouseEvent) => {
      if (!palette.contains(e.target as Node)) {
        palette.remove();
        document.removeEventListener("click", clickOutside);
      }
    };
    document.addEventListener("click", clickOutside);
  }, 0);
};

const deleteBackground = (index: number) => {
  const defaultCount = defaultBackgrounds.length;
  // Only allow deleting custom backgrounds
  if (index < defaultCount) return;

  const customIndex = index - defaultCount;
  state.customBackgrounds.splice(customIndex, 1);

  const backgrounds = getBackgrounds();
  if (currentImageIndex === index) {
    currentImageIndex = 0;
    state.backgroundImageIndex = 0;
    if (backgrounds.length > 0) {
      const newBackground = backgrounds[0];
      if (newBackground) {
        document.body.style.backgroundImage = `url('${getResizedImageUrl(
          newBackground.url
        )}')`;
        if (!state.themeLocked && newBackground.theme) {
          applyTheme(newBackground.theme);
          state.currentTheme = newBackground.theme;
        }
      }
    } else {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "#f4f4f9";
      applyTheme("theme-white");
    }
  } else if (currentImageIndex > index) {
    currentImageIndex--;
    state.backgroundImageIndex = currentImageIndex;
  }

  saveState();
  populateCarousel();
};

changeThemeButton.addEventListener("click", () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  const newTheme = themes[currentThemeIndex];
  if (newTheme) {
    applyTheme(newTheme);
    state.currentTheme = newTheme;
    state.themeLocked = true; // Lock theme when manually changed
    updateThemeLockButton();
    saveState();
  }
});

// Theme lock button
const themeLockButton = document.createElement("button");
themeLockButton.id = "theme-lock-button";
themeLockButton.textContent = "🔓 Auto";
document.querySelector(".controls-container")?.appendChild(themeLockButton);

const updateThemeLockButton = () => {
  themeLockButton.textContent = state.themeLocked ? "🔒 Locked" : "🔓 Auto";
};

themeLockButton.addEventListener("click", () => {
  state.themeLocked = !state.themeLocked;
  updateThemeLockButton();
  saveState();
});

// Global click handler to close menus when clicking outside
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  // Close edit mode on tasks when clicking outside
  const editingTask = document.querySelector("#todo-list li.editing");
  if (editingTask && !editingTask.contains(target)) {
    render(); // Re-render to exit edit mode
  }
});
